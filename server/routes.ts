import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import * as storage from "./storage";
import * as ocr from "./ocr";
import * as paddleocr from "./paddleocr";
import * as webaiocr from "./webai-ocr";
import * as ai from "./ai";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";
import { db } from "@db";
import { format, startOfWeek, endOfWeek, subDays } from "date-fns";

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Mock user ID for demonstration (in a real app, this would come from auth)
const MOCK_USER_ID = 1;

/**
 * Safely parse a date string and return a valid ISO date string
 * If parsing fails, return today's date as ISO string
 * 
 * @param dateStr Date string to parse
 * @returns ISO date string (YYYY-MM-DD)
 */
function safeParseDate(dateStr: string | undefined): string {
  try {
    if (!dateStr) {
      return new Date().toISOString().split('T')[0];
    }

    // Try to detect and fix common date formats
    let normalizedDate = dateStr;
    
    // Handle "Month DD, YYYY" format (e.g. "September 22, 2020")
    const monthNameMatch = dateStr.match(/([A-Za-z]+)\s+(\d{1,2})[\s,]+(\d{4})/);
    if (monthNameMatch) {
      const months: Record<string, number> = {
        january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
        july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
      };
      
      const monthName = monthNameMatch[1].toLowerCase();
      const day = parseInt(monthNameMatch[2], 10);
      const year = parseInt(monthNameMatch[3], 10);
      
      if (months[monthName] !== undefined && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
        const date = new Date(year, months[monthName], day);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      }
    }
    
    // Check various date formats
    const parsedDate = new Date(normalizedDate);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString().split('T')[0];
    }
    
    // Fallback to current date
    return new Date().toISOString().split('T')[0];
  } catch (error) {
    console.error('Error parsing date:', error);
    return new Date().toISOString().split('T')[0];
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  // === Journal Routes ===
  
  // Get journal entries
  app.get("/api/journal/entries", async (_req: Request, res: Response) => {
    try {
      const entries = await storage.getJournalEntries(MOCK_USER_ID);
      res.json({ entries });
    } catch (error) {
      console.error("Error fetching journal entries:", error);
      res.status(500).json({ message: "Error fetching journal entries" });
    }
  });
  
  // Get last journal upload date
  app.get("/api/journal/last-upload", async (_req: Request, res: Response) => {
    try {
      const result = await storage.getLastJournalUpload(MOCK_USER_ID);
      res.json(result);
    } catch (error) {
      console.error("Error fetching last journal upload:", error);
      res.status(500).json({ message: "Error fetching last journal upload" });
    }
  });
  
  // Add journal entry
  app.post("/api/journal/entry", async (req: Request, res: Response) => {
    try {
      const date = format(new Date(req.body.date), "yyyy-MM-dd");
      
      // Create journal entry
      const journal = await storage.insertJournal({
        userId: MOCK_USER_ID,
        content: req.body.content,
        date,
        imageUrl: null
      });
      
      // Create mood entry if provided
      if (req.body.mood) {
        await storage.insertMood({
          userId: MOCK_USER_ID,
          value: parseInt(req.body.mood),
          date
        });
      }
      
      // Create sleep entry if provided
      if (req.body.sleep) {
        await storage.insertSleep({
          userId: MOCK_USER_ID,
          hours: parseFloat(req.body.sleep),
          date
        });
      }
      
      // Create activity entry if activities provided
      if (req.body.activities) {
        const activities = req.body.activities.split(',').map((a: string) => a.trim());
        
        // Calculate steps estimate based on activities
        const hasExercise = activities.some(activity => 
          ["walk", "run", "gym", "exercise", "workout", "jog", "swim", "yoga"].some(term => 
            activity.toLowerCase().includes(term)
          )
        );
        
        // Create an activity entry with an estimated step count
        const steps = hasExercise ? Math.floor(Math.random() * 5000) + 5000 : Math.floor(Math.random() * 3000) + 2000;
        
        await storage.insertActivity({
          userId: MOCK_USER_ID,
          steps,
          date
        });
      }
      
      // Generate journal insights
      await updateJournalInsights(MOCK_USER_ID);
      
      // Check for new achievements
      await checkAndUpdateAchievements(MOCK_USER_ID);
      
      res.status(201).json({ success: true, journal });
    } catch (error) {
      console.error("Error adding journal entry:", error);
      res.status(500).json({ message: "Error adding journal entry" });
    }
  });
  
  // Upload and process journal image
  app.post("/api/journal/upload", upload.single("journal"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      // Save uploaded image to temp file
      const imagePath = ocr.saveUploadedImage(
        req.file.buffer, 
        req.file.originalname
      );
      
      // Perform OCR on the image
      const ocrResult = await ocr.performOCR(imagePath);
      
      if (!ocrResult.success) {
        ocr.cleanupImage(imagePath);
        return res.status(500).json({ message: ocrResult.error || "OCR processing failed" });
      }
      
      // Extract structured data from OCR text
      const journalData = ocr.extractJournalData(ocrResult.text);
      
      // Save to database using safe date parsing
      const date = safeParseDate(journalData.date);
      
      // Create journal entry
      const journal = await storage.insertJournal({
        userId: MOCK_USER_ID,
        content: journalData.content,
        date,
        imageUrl: null // We don't store the actual image, just the extracted content
      });
      
      // Create mood entry if extracted
      if (journalData.mood !== undefined) {
        await storage.insertMood({
          userId: MOCK_USER_ID,
          value: journalData.mood,
          date
        });
      }
      
      // Create sleep entry if extracted
      if (journalData.sleep !== undefined) {
        await storage.insertSleep({
          userId: MOCK_USER_ID,
          hours: journalData.sleep,
          date
        });
      }
      
      // Save activities if extracted
      if (journalData.activities.length > 0) {
        // Calculate steps estimate based on activities
        const hasExercise = journalData.activities.some(activity => 
          ["walk", "run", "gym", "exercise", "workout", "jog", "swim", "yoga"].some(term => 
            activity.toLowerCase().includes(term)
          )
        );
        
        // Create an activity entry with an estimated step count
        const steps = hasExercise ? Math.floor(Math.random() * 5000) + 5000 : Math.floor(Math.random() * 3000) + 2000;
        
        await storage.insertActivity({
          userId: MOCK_USER_ID,
          steps,
          date
        });
      }
      
      // Clean up temp file
      ocr.cleanupImage(imagePath);
      
      // Generate journal insights
      await updateJournalInsights(MOCK_USER_ID);
      
      // Check for new achievements
      await checkAndUpdateAchievements(MOCK_USER_ID);
      
      res.json({ 
        success: true, 
        message: "Journal processed successfully",
        journal
      });
    } catch (error) {
      console.error("Error processing journal upload:", error);
      res.status(500).json({ message: "Failed to process journal upload" });
    }
  });
  
  // Upload and process journal image with PaddleJS OCR
  app.post("/api/journal/upload/paddle", upload.single("journal"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      // Save uploaded image to temp file
      const imagePath = paddleocr.saveUploadedImage(
        req.file.buffer, 
        req.file.originalname
      );
      
      // Perform OCR using PaddleJS
      const ocrResult = await paddleocr.performPaddleOCR(imagePath);
      
      if (!ocrResult.success) {
        paddleocr.cleanupImage(imagePath);
        return res.status(500).json({ message: ocrResult.error || "PaddleJS OCR processing failed" });
      }
      
      // Extract structured data from OCR text using the same extraction logic
      const journalData = ocr.extractJournalData(ocrResult.text);
      
      // Save to database
      const date = journalData.date 
        ? new Date(journalData.date).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];
      
      // Create journal entry
      const journal = await storage.insertJournal({
        userId: MOCK_USER_ID,
        content: journalData.content,
        date,
        imageUrl: null // We don't store the actual image, just the extracted content
      });
      
      // Create mood entry if extracted
      if (journalData.mood !== undefined) {
        await storage.insertMood({
          userId: MOCK_USER_ID,
          value: journalData.mood,
          date
        });
      }
      
      // Create sleep entry if extracted
      if (journalData.sleep !== undefined) {
        await storage.insertSleep({
          userId: MOCK_USER_ID,
          hours: journalData.sleep,
          date
        });
      }
      
      // Save activities if extracted
      if (journalData.activities.length > 0) {
        // Calculate steps estimate based on activities
        const hasExercise = journalData.activities.some(activity => 
          ["walk", "run", "gym", "exercise", "workout", "jog", "swim", "yoga"].some(term => 
            activity.toLowerCase().includes(term)
          )
        );
        
        // Create an activity entry with an estimated step count
        const steps = hasExercise ? Math.floor(Math.random() * 5000) + 5000 : Math.floor(Math.random() * 3000) + 2000;
        
        await storage.insertActivity({
          userId: MOCK_USER_ID,
          steps,
          date
        });
      }
      
      // Clean up temp file
      paddleocr.cleanupImage(imagePath);
      
      // Generate journal insights
      await updateJournalInsights(MOCK_USER_ID);
      
      // Check for new achievements
      await checkAndUpdateAchievements(MOCK_USER_ID);
      
      res.json({ 
        success: true, 
        message: "Journal processed successfully with PaddleJS OCR",
        journal
      });
    } catch (error) {
      console.error("PaddleJS OCR processing error:", error);
      res.status(500).json({ message: "Failed to process journal with PaddleJS OCR" });
    }
  });
  
  // Upload and process journal image with Web AI Toolkit OCR
  app.post("/api/journal/upload/webai", upload.single("journal"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      // Save uploaded image to temp file
      const imagePath = webaiocr.saveUploadedImage(
        req.file.buffer, 
        req.file.originalname
      );
      
      // Perform OCR using Web AI Toolkit
      const ocrResult = await webaiocr.performWebAiOCR(imagePath);
      
      if (!ocrResult.success) {
        webaiocr.cleanupImage(imagePath);
        return res.status(500).json({ message: ocrResult.error || "Web AI Toolkit OCR processing failed" });
      }
      
      // Extract structured data from OCR text using the same extraction logic
      const journalData = ocr.extractJournalData(ocrResult.text);
      
      // Save to database
      const date = journalData.date 
        ? new Date(journalData.date).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];
      
      // Create journal entry
      const journal = await storage.insertJournal({
        userId: MOCK_USER_ID,
        content: journalData.content,
        date,
        imageUrl: null // We don't store the actual image, just the extracted content
      });
      
      // Create mood entry if extracted
      if (journalData.mood !== undefined) {
        await storage.insertMood({
          userId: MOCK_USER_ID,
          value: journalData.mood,
          date
        });
      }
      
      // Create sleep entry if extracted
      if (journalData.sleep !== undefined) {
        await storage.insertSleep({
          userId: MOCK_USER_ID,
          hours: journalData.sleep,
          date
        });
      }
      
      // Save activities if extracted
      if (journalData.activities.length > 0) {
        // Calculate steps estimate based on activities
        const hasExercise = journalData.activities.some(activity => 
          ["walk", "run", "gym", "exercise", "workout", "jog", "swim", "yoga"].some(term => 
            activity.toLowerCase().includes(term)
          )
        );
        
        // Create an activity entry with an estimated step count
        const steps = hasExercise ? Math.floor(Math.random() * 5000) + 5000 : Math.floor(Math.random() * 3000) + 2000;
        
        await storage.insertActivity({
          userId: MOCK_USER_ID,
          steps,
          date
        });
      }
      
      // Clean up temp file
      webaiocr.cleanupImage(imagePath);
      
      // Generate journal insights
      await updateJournalInsights(MOCK_USER_ID);
      
      // Check for new achievements
      await checkAndUpdateAchievements(MOCK_USER_ID);
      
      res.json({ 
        success: true, 
        message: "Journal processed successfully with Web AI Toolkit OCR",
        journal
      });
    } catch (error) {
      console.error("Web AI Toolkit OCR processing error:", error);
      res.status(500).json({ message: "Failed to process journal with Web AI Toolkit OCR" });
    }
  });
  
  // === Mood Routes ===
  
  // Get mood data
  app.get("/api/mood", async (_req: Request, res: Response) => {
    try {
      const now = new Date();
      const startDate = format(startOfWeek(now), "yyyy-MM-dd");
      const endDate = format(now, "yyyy-MM-dd");
      
      // Get mood data for the current week
      const moodData = await storage.getMoods(MOCK_USER_ID, startDate, endDate);
      
      // Get previous week data for comparison
      const prevWeekStart = format(startOfWeek(subDays(now, 7)), "yyyy-MM-dd");
      const prevWeekEnd = format(subDays(startOfWeek(now), 1), "yyyy-MM-dd");
      const prevWeekData = await storage.getMoods(MOCK_USER_ID, prevWeekStart, prevWeekEnd);
      
      // Calculate weekly change
      const weeklyChange = moodData.average - prevWeekData.average;
      
      res.json({ ...moodData, weeklyChange });
    } catch (error) {
      console.error("Error fetching mood data:", error);
      res.status(500).json({ message: "Error fetching mood data" });
    }
  });
  
  // Add mood entry
  app.post("/api/mood", async (req: Request, res: Response) => {
    try {
      const date = format(new Date(req.body.date), "yyyy-MM-dd");
      
      const mood = await storage.insertMood({
        userId: MOCK_USER_ID,
        value: parseInt(req.body.value),
        date
      });
      
      res.status(201).json(mood);
    } catch (error) {
      console.error("Error adding mood entry:", error);
      res.status(500).json({ message: "Error adding mood entry" });
    }
  });
  
  // === Sleep Routes ===
  
  // Get sleep data
  app.get("/api/sleep", async (_req: Request, res: Response) => {
    try {
      const now = new Date();
      const startDate = format(startOfWeek(now), "yyyy-MM-dd");
      const endDate = format(now, "yyyy-MM-dd");
      
      // Get sleep data for the current week
      const sleepData = await storage.getSleep(MOCK_USER_ID, startDate, endDate);
      
      // Get previous week data for comparison
      const prevWeekStart = format(startOfWeek(subDays(now, 7)), "yyyy-MM-dd");
      const prevWeekEnd = format(subDays(startOfWeek(now), 1), "yyyy-MM-dd");
      const prevWeekData = await storage.getSleep(MOCK_USER_ID, prevWeekStart, prevWeekEnd);
      
      // Calculate weekly change
      const weeklyChange = sleepData.average - prevWeekData.average;
      
      res.json({ ...sleepData, weeklyChange });
    } catch (error) {
      console.error("Error fetching sleep data:", error);
      res.status(500).json({ message: "Error fetching sleep data" });
    }
  });
  
  // Add sleep entry
  app.post("/api/sleep", async (req: Request, res: Response) => {
    try {
      const date = format(new Date(req.body.date), "yyyy-MM-dd");
      
      const sleep = await storage.insertSleep({
        userId: MOCK_USER_ID,
        hours: parseFloat(req.body.hours),
        date
      });
      
      res.status(201).json(sleep);
    } catch (error) {
      console.error("Error adding sleep entry:", error);
      res.status(500).json({ message: "Error adding sleep entry" });
    }
  });
  
  // === Activity Routes ===
  
  // Get activity data
  app.get("/api/activity", async (_req: Request, res: Response) => {
    try {
      const now = new Date();
      const startDate = format(startOfWeek(now), "yyyy-MM-dd");
      const endDate = format(now, "yyyy-MM-dd");
      
      // Get activity data for the current week
      const activityData = await storage.getActivity(MOCK_USER_ID, startDate, endDate);
      
      // Get previous week data for comparison
      const prevWeekStart = format(startOfWeek(subDays(now, 7)), "yyyy-MM-dd");
      const prevWeekEnd = format(subDays(startOfWeek(now), 1), "yyyy-MM-dd");
      const prevWeekData = await storage.getActivity(MOCK_USER_ID, prevWeekStart, prevWeekEnd);
      
      // Calculate weekly change
      const weeklyChange = activityData.average - prevWeekData.average;
      
      res.json({ ...activityData, weeklyChange });
    } catch (error) {
      console.error("Error fetching activity data:", error);
      res.status(500).json({ message: "Error fetching activity data" });
    }
  });
  
  // Add activity entry
  app.post("/api/activity", async (req: Request, res: Response) => {
    try {
      const date = format(new Date(req.body.date), "yyyy-MM-dd");
      
      const activity = await storage.insertActivity({
        userId: MOCK_USER_ID,
        steps: parseInt(req.body.steps),
        date
      });
      
      res.status(201).json(activity);
    } catch (error) {
      console.error("Error adding activity entry:", error);
      res.status(500).json({ message: "Error adding activity entry" });
    }
  });
  
  // === Journal Insights Routes ===
  
  // Get journal insights
  app.get("/api/journal/insights", async (_req: Request, res: Response) => {
    try {
      const insights = await storage.getJournalInsights(MOCK_USER_ID);
      res.json(insights);
    } catch (error) {
      console.error("Error fetching journal insights:", error);
      res.status(500).json({ message: "Error fetching journal insights" });
    }
  });
  
  // === Tips Routes ===
  
  // Get personalized tips
  app.get("/api/tips", async (_req: Request, res: Response) => {
    try {
      // Generate fresh tips based on latest data
      const now = new Date();
      const startDate = format(subDays(now, 30), "yyyy-MM-dd");
      const endDate = format(now, "yyyy-MM-dd");
      
      // Get recent data
      const moodData = await storage.getMoods(MOCK_USER_ID, startDate, endDate);
      const sleepData = await storage.getSleep(MOCK_USER_ID, startDate, endDate);
      const activityData = await storage.getActivity(MOCK_USER_ID, startDate, endDate);
      const journals = await storage.getJournalEntries(MOCK_USER_ID, 10);
      
      // Generate tips based on data trends
      const tips = ai.generatePersonalizedTips(
        MOCK_USER_ID,
        moodData.moods,
        sleepData.sleep,
        activityData.activity,
        journals
      );
      
      res.json({ tips });
    } catch (error) {
      console.error("Error fetching tips:", error);
      res.status(500).json({ message: "Error fetching tips" });
    }
  });
  
  // === Achievements Routes ===
  
  // Get achievements
  app.get("/api/achievements", async (_req: Request, res: Response) => {
    try {
      const achievementsData = await storage.getAllAchievements(MOCK_USER_ID);
      res.json(achievementsData);
    } catch (error) {
      console.error("Error fetching achievements:", error);
      res.status(500).json({ message: "Error fetching achievements" });
    }
  });
  
  // Create HTTP server and return it
  const httpServer = createServer(app);
  
  return httpServer;
}

/**
 * Update journal insights based on recent entries
 */
async function updateJournalInsights(userId: number): Promise<void> {
  try {
    // Get recent journal entries
    const entries = await storage.getJournalEntries(userId, 30);
    
    // Extract themes
    const themes = ai.extractJournalThemes(entries);
    
    // Get recent data for correlation analysis
    const now = new Date();
    const startDate = format(subDays(now, 30), "yyyy-MM-dd");
    const endDate = format(now, "yyyy-MM-dd");
    
    const moodData = await storage.getMoods(userId, startDate, endDate);
    const sleepData = await storage.getSleep(userId, startDate, endDate);
    const activityData = await storage.getActivity(userId, startDate, endDate);
    
    // Find correlations
    const correlations = ai.findJournalCorrelations(
      moodData.moods,
      sleepData.sleep,
      activityData.activity,
      entries
    );
    
    // Update or create journal insights
    const insights = await storage.getJournalInsights(userId);
    if (insights && insights.id) {
      await db.update(schema.journalInsights)
        .set({
          themes: themes,
          correlations: correlations,
          lastUpdated: new Date().toISOString().split('T')[0]
        })
        .where(eq(schema.journalInsights.userId, userId))
        .execute();
    } else {
      await storage.insertJournalInsight({
        userId,
        themes,
        correlations,
        lastUpdated: new Date().toISOString().split('T')[0]
      });
    }
  } catch (error) {
    console.error("Error updating journal insights:", error);
  }
}

/**
 * Checks for new achievements and updates the database
 */
async function checkAndUpdateAchievements(userId: number): Promise<void> {
  try {
    // Get user's current achievements
    const achievementsData = await storage.getAllAchievements(userId);
    const userAchievements = achievementsData.achievements;
    
    // Get recent data for achievement checks
    const now = new Date();
    const startDate = format(subDays(now, 30), "yyyy-MM-dd");
    const endDate = format(now, "yyyy-MM-dd");
    
    const moodData = await storage.getMoods(userId, startDate, endDate);
    const sleepData = await storage.getSleep(userId, startDate, endDate);
    const activityData = await storage.getActivity(userId, startDate, endDate);
    const journals = await storage.getJournalEntries(userId, 30);
    
    // Check for new achievements
    const achievedIds = ai.checkAchievements(
      moodData.moods,
      sleepData.sleep,
      activityData.activity,
      journals
    );
    
    // Update user achievements
    for (const achievementId of achievedIds) {
      const achievement = userAchievements.find(a => a.id === achievementId);
      
      if (achievement && !achievement.unlocked) {
        await storage.updateUserAchievement(userId, achievementId, {
          unlocked: true,
          unlockedAt: new Date().toISOString()
        });
      }
    }
  } catch (error) {
    console.error("Error checking achievements:", error);
  }
}