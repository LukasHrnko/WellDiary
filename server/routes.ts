import express, { type Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import * as storage from "./storage";
import * as ai from "./ai";
import * as trocr from "./huggingface-api";
import * as extractUtils from "./extract-utils";
import * as schema from "@shared/schema";
import { journalInsights, userAchievements } from "@shared/schema";
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
  if (!dateStr) {
    return format(new Date(), 'yyyy-MM-dd');
  }
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date');
    }
    return format(date, 'yyyy-MM-dd');
  } catch (e) {
    return format(new Date(), 'yyyy-MM-dd');
  }
}

// Import auth setup
import { setupAuth } from "./auth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  setupAuth(app);
  
  // Set up express JSON middleware
  app.use(express.json());
  
  // === Health Check ===
  app.get("/api/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "healthy" });
  });
  
  // === Journal Routes ===
  
  app.get("/api/journal/entries", async (_req: Request, res: Response) => {
    try {
      const entries = await storage.getJournalEntries(MOCK_USER_ID, 90);
      res.json({ entries });
    } catch (error) {
      console.error("Error fetching journal entries:", error);
      res.status(500).json({ message: "Failed to fetch journal entries" });
    }
  });
  
  app.get("/api/journal/last-upload", async (_req: Request, res: Response) => {
    try {
      const lastEntry = await storage.getLastJournalEntry(MOCK_USER_ID);
      res.json({ lastEntry });
    } catch (error) {
      console.error("Error fetching last journal entry:", error);
      res.status(500).json({ message: "Failed to fetch last journal entry" });
    }
  });
  
  app.post("/api/journal/entry", async (req: Request, res: Response) => {
    try {
      const { content, date, imageUrl } = req.body;
      
      if (!content) {
        return res.status(400).json({ message: "Content is required" });
      }
      
      const safeDate = safeParseDate(date);
      
      const journal = await storage.insertJournal({
        userId: MOCK_USER_ID,
        content,
        date: safeDate,
        imageUrl
      });
      
      // Update insights asynchronously
      updateJournalInsights(MOCK_USER_ID).catch(err => 
        console.error("Failed to update journal insights:", err)
      );
      
      // Check for new achievements
      checkAndUpdateAchievements(MOCK_USER_ID).catch(err => 
        console.error("Failed to check achievements:", err)
      );
      
      res.json({ journal });
    } catch (error) {
      console.error("Error creating journal entry:", error);
      res.status(500).json({ message: "Failed to create journal entry" });
    }
  });
  
  // TrOCR API for handwritten text recognition
  app.post("/api/journal/upload/trocr", upload.single("journal"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      // Save uploaded image to temp file
      const imagePath = trocr.saveUploadedImage(
        req.file.buffer, 
        req.file.originalname
      );
      
      // Process image with TrOCR
      const ocrResult = await trocr.performTrOCR(imagePath);
      
      if (!ocrResult.success) {
        trocr.cleanupImage(imagePath);
        return res.status(500).json({ message: ocrResult.error, success: false });
      }
      
      // Extract structured data
      const journalData = extractUtils.extractJournalData(ocrResult.text);
      
      // Create journal entry
      const date = safeParseDate(journalData.date);
      
      const journal = await storage.insertJournal({
        userId: MOCK_USER_ID,
        content: journalData.content,
        date,
        imageUrl: null
      });
      
      // Create mood entry if detected
      if (journalData.mood !== undefined) {
        await storage.insertMood({
          userId: MOCK_USER_ID,
          value: journalData.mood,
          date
        });
      }
      
      // Create sleep entry if detected
      if (journalData.sleep !== undefined) {
        await storage.insertSleep({
          userId: MOCK_USER_ID,
          hours: journalData.sleep,
          date
        });
      }
      
      // Create activity entry if activities detected
      if (journalData.activities && journalData.activities.length > 0) {
        const steps = Math.floor(Math.random() * 5000) + 3000;
        await storage.insertActivity({
          userId: MOCK_USER_ID,
          steps,
          date
        });
      }
      
      // Clean up the temporary image
      trocr.cleanupImage(imagePath);
      
      // Update insights asynchronously
      updateJournalInsights(MOCK_USER_ID).catch(err => 
        console.error("Failed to update journal insights:", err)
      );
      
      // Check for new achievements
      checkAndUpdateAchievements(MOCK_USER_ID).catch(err => 
        console.error("Failed to check achievements:", err)
      );
      
      res.status(200).json({ 
        success: true, 
        message: "Journal processed successfully",
        journalId: journal.id,
        text: ocrResult.text
      });
    } catch (error) {
      console.error("Error processing journal upload:", error);
      res.status(500).json({ message: "Failed to process journal" });
    }
  });
  
  // Default upload endpoint now uses TrOCR
  app.post("/api/journal/upload", upload.single("journal"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      // Save uploaded image to temp file
      const imagePath = trocr.saveUploadedImage(
        req.file.buffer, 
        req.file.originalname
      );
      
      // Process image with TrOCR
      const ocrResult = await trocr.performTrOCR(imagePath);
      
      if (!ocrResult.success) {
        trocr.cleanupImage(imagePath);
        return res.status(500).json({ message: ocrResult.error, success: false });
      }
      
      // Extract structured data
      const journalData = extractUtils.extractJournalData(ocrResult.text);
      
      // Create journal entry
      const date = safeParseDate(journalData.date);
      
      const journal = await storage.insertJournal({
        userId: MOCK_USER_ID,
        content: journalData.content,
        date,
        imageUrl: null
      });
      
      // Create mood entry if detected
      if (journalData.mood !== undefined) {
        await storage.insertMood({
          userId: MOCK_USER_ID,
          value: journalData.mood,
          date
        });
      }
      
      // Create sleep entry if detected
      if (journalData.sleep !== undefined) {
        await storage.insertSleep({
          userId: MOCK_USER_ID,
          hours: journalData.sleep,
          date
        });
      }
      
      // Create activity entry if activities detected
      if (journalData.activities && journalData.activities.length > 0) {
        const steps = Math.floor(Math.random() * 5000) + 3000;
        await storage.insertActivity({
          userId: MOCK_USER_ID,
          steps,
          date
        });
      }
      
      // Clean up the temporary image
      trocr.cleanupImage(imagePath);
      
      // Update insights asynchronously
      updateJournalInsights(MOCK_USER_ID).catch(err => 
        console.error("Failed to update journal insights:", err)
      );
      
      // Check for new achievements
      checkAndUpdateAchievements(MOCK_USER_ID).catch(err => 
        console.error("Failed to check achievements:", err)
      );
      
      res.status(200).json({ 
        success: true, 
        message: "Journal processed successfully",
        journalId: journal.id,
        text: ocrResult.text
      });
    } catch (error) {
      console.error("Error processing journal upload:", error);
      res.status(500).json({ message: "Failed to process journal" });
    }
  });
  
  app.post("/api/journal/analyze", async (req: Request, res: Response) => {
    try {
      const { text } = req.body;
      
      if (!text) {
        return res.status(400).json({ message: "Text is required" });
      }
      
      // Extract structured data
      const journalData = extractUtils.extractJournalData(text);
      
      res.json({
        analyzed: true,
        data: journalData
      });
    } catch (error) {
      console.error("Error analyzing journal text:", error);
      res.status(500).json({ message: "Failed to analyze journal text" });
    }
  });
  
  // Get journal insights for a user
  app.get("/api/journal/insights", async (_req: Request, res: Response) => {
    try {
      // Get insights from database
      const insights = await db.query.journalInsights.findFirst({
        where: eq(journalInsights.userId, MOCK_USER_ID)
      });
      
      if (!insights) {
        // If no insights yet, generate them now
        await updateJournalInsights(MOCK_USER_ID);
        
        // Try fetching again
        const newInsights = await db.query.journalInsights.findFirst({
          where: eq(journalInsights.userId, MOCK_USER_ID)
        });
        
        return res.json(newInsights || { 
          themes: [],
          correlations: [],
          userId: MOCK_USER_ID
        });
      }
      
      res.json(insights);
    } catch (error) {
      console.error("Error fetching journal insights:", error);
      res.status(500).json({ message: "Failed to fetch journal insights" });
    }
  });
  
  // === Activity Routes ===
  
  app.get("/api/activity", async (_req: Request, res: Response) => {
    try {
      // Get all activity data
      const today = new Date();
      const startDate = format(subDays(today, 30), 'yyyy-MM-dd'); // last 30 days
      const endDate = format(today, 'yyyy-MM-dd');
      
      const data = await storage.getActivity(MOCK_USER_ID, startDate, endDate);
      
      // Add formatted date string
      const activityWithDate = data.activity.map(activity => ({
        ...activity,
        formattedDate: format(new Date(activity.date), 'MMM d')
      }));
      
      res.json({ 
        activity: activityWithDate, 
        average: data.average,
        goal: data.goal
      });
    } catch (error) {
      console.error("Error fetching activity data:", error);
      res.status(500).json({ message: "Failed to fetch activity data" });
    }
  });
  
  app.post("/api/activity", async (req: Request, res: Response) => {
    try {
      const { steps, date } = req.body;
      
      if (steps === undefined || steps < 0) {
        return res.status(400).json({ message: "Invalid steps value" });
      }
      
      const safeDate = safeParseDate(date);
      
      const activity = await storage.insertActivity({
        userId: MOCK_USER_ID,
        steps,
        date: safeDate
      });
      
      // Check for new achievements
      checkAndUpdateAchievements(MOCK_USER_ID).catch(err => 
        console.error("Failed to check achievements:", err)
      );
      
      res.json({ activity });
    } catch (error) {
      console.error("Error creating activity entry:", error);
      res.status(500).json({ message: "Failed to create activity entry" });
    }
  });
  
  app.get("/api/activity/monthly", async (_req: Request, res: Response) => {
    try {
      // Get monthly activity data
      const today = new Date();
      const startDate = new Date(today.getFullYear(), today.getMonth() - 5, 1);
      const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      
      const formattedStartDate = format(startDate, 'yyyy-MM-dd');
      const formattedEndDate = format(endDate, 'yyyy-MM-dd');
      
      const data = await storage.getMonthlyActivity(MOCK_USER_ID, formattedStartDate, formattedEndDate);
      
      res.json({ monthlyData: data });
    } catch (error) {
      console.error("Error fetching monthly activity data:", error);
      res.status(500).json({ message: "Failed to fetch monthly activity data" });
    }
  });
  
  // === Mood Routes ===
  
  app.get("/api/mood", async (_req: Request, res: Response) => {
    try {
      // Get all mood data
      const today = new Date();
      const startDate = format(subDays(today, 30), 'yyyy-MM-dd'); // last 30 days
      const endDate = format(today, 'yyyy-MM-dd');
      
      const data = await storage.getMoods(MOCK_USER_ID, startDate, endDate);
      
      // Add formatted date string
      const moodsWithDate = data.moods.map(mood => ({
        ...mood,
        formattedDate: format(new Date(mood.date), 'MMM d')
      }));
      
      res.json({ 
        moods: moodsWithDate, 
        average: parseFloat(data.average.toFixed(1)) 
      });
    } catch (error) {
      console.error("Error fetching moods:", error);
      res.status(500).json({ message: "Failed to fetch moods" });
    }
  });
  
  app.post("/api/mood", async (req: Request, res: Response) => {
    try {
      const { value, date } = req.body;
      
      if (value === undefined || value < 1 || value > 10) {
        return res.status(400).json({ message: "Invalid mood value. Must be between 1 and 10." });
      }
      
      const safeDate = safeParseDate(date);
      
      const mood = await storage.insertMood({
        userId: MOCK_USER_ID,
        value,
        date: safeDate
      });
      
      // Check for new achievements
      checkAndUpdateAchievements(MOCK_USER_ID).catch(err => 
        console.error("Failed to check achievements:", err)
      );
      
      res.json({ mood });
    } catch (error) {
      console.error("Error creating mood entry:", error);
      res.status(500).json({ message: "Failed to create mood entry" });
    }
  });
  
  app.get("/api/mood/monthly", async (_req: Request, res: Response) => {
    try {
      // Get monthly mood data
      const today = new Date();
      const startDate = new Date(today.getFullYear(), today.getMonth() - 5, 1);
      const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      
      const formattedStartDate = format(startDate, 'yyyy-MM-dd');
      const formattedEndDate = format(endDate, 'yyyy-MM-dd');
      
      const data = await storage.getMonthlyMoods(MOCK_USER_ID, formattedStartDate, formattedEndDate);
      
      res.json({ monthlyData: data });
    } catch (error) {
      console.error("Error fetching monthly mood data:", error);
      res.status(500).json({ message: "Failed to fetch monthly mood data" });
    }
  });
  
  // === Sleep Routes ===
  
  app.get("/api/sleep", async (_req: Request, res: Response) => {
    try {
      // Get all sleep data
      const today = new Date();
      const startDate = format(subDays(today, 30), 'yyyy-MM-dd'); // last 30 days
      const endDate = format(today, 'yyyy-MM-dd');
      
      const data = await storage.getSleep(MOCK_USER_ID, startDate, endDate);
      
      // Add formatted date string
      const sleepWithDate = data.sleep.map(item => ({
        ...item,
        formattedDate: format(new Date(item.date), 'MMM d')
      }));
      
      res.json({ 
        sleep: sleepWithDate, 
        average: parseFloat(data.average.toFixed(1)),
        goal: data.goal
      });
    } catch (error) {
      console.error("Error fetching sleep data:", error);
      res.status(500).json({ message: "Failed to fetch sleep data" });
    }
  });
  
  app.post("/api/sleep", async (req: Request, res: Response) => {
    try {
      const { hours, date } = req.body;
      
      if (hours === undefined || hours < 0 || hours > 24) {
        return res.status(400).json({ message: "Invalid sleep hours. Must be between 0 and 24." });
      }
      
      const safeDate = safeParseDate(date);
      
      const sleep = await storage.insertSleep({
        userId: MOCK_USER_ID,
        hours,
        date: safeDate
      });
      
      // Check for new achievements
      checkAndUpdateAchievements(MOCK_USER_ID).catch(err => 
        console.error("Failed to check achievements:", err)
      );
      
      res.json({ sleep });
    } catch (error) {
      console.error("Error creating sleep entry:", error);
      res.status(500).json({ message: "Failed to create sleep entry" });
    }
  });
  
  app.get("/api/sleep/monthly", async (_req: Request, res: Response) => {
    try {
      // Get monthly sleep data
      const today = new Date();
      const startDate = new Date(today.getFullYear(), today.getMonth() - 5, 1);
      const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      
      const formattedStartDate = format(startDate, 'yyyy-MM-dd');
      const formattedEndDate = format(endDate, 'yyyy-MM-dd');
      
      const data = await storage.getMonthlySleep(MOCK_USER_ID, formattedStartDate, formattedEndDate);
      
      res.json({ monthlyData: data });
    } catch (error) {
      console.error("Error fetching monthly sleep data:", error);
      res.status(500).json({ message: "Failed to fetch monthly sleep data" });
    }
  });
  
  // === Tips and Achievements Routes ===
  
  app.get("/api/tips", async (_req: Request, res: Response) => {
    try {
      // Get recent user data
      const today = new Date();
      const startDate = format(subDays(today, 30), 'yyyy-MM-dd'); // last 30 days
      const endDate = format(today, 'yyyy-MM-dd');
      
      const moodsData = await storage.getMoods(MOCK_USER_ID, startDate, endDate);
      const sleepData = await storage.getSleep(MOCK_USER_ID, startDate, endDate);
      const activityData = await storage.getActivity(MOCK_USER_ID, startDate, endDate);
      const journals = await storage.getJournalEntries(MOCK_USER_ID, 30);
      
      // Generate personalized tips
      const tips = ai.generatePersonalizedTips(
        MOCK_USER_ID,
        moodsData.moods,
        sleepData.sleep,
        activityData.activity,
        journals
      );
      
      res.json({ tips });
    } catch (error) {
      console.error("Error fetching personalized tips:", error);
      res.status(500).json({ message: "Failed to fetch personalized tips" });
    }
  });
  
  app.get("/api/achievements", async (_req: Request, res: Response) => {
    try {
      // Get user achievements
      const achievements = await db.query.userAchievements.findMany({
        where: eq(userAchievements.userId, MOCK_USER_ID)
      });
      
      res.json({ achievements });
    } catch (error) {
      console.error("Error fetching achievements:", error);
      res.status(500).json({ message: "Failed to fetch achievements" });
    }
  });
  
  // Create HTTP server
  const httpServer = createServer(app);
  
  return httpServer;
}

/**
 * Update journal insights based on recent entries
 */
async function updateJournalInsights(userId: number): Promise<void> {
  try {
    // Get recent journal entries
    const journals = await storage.getJournalEntries(userId, 90);
    
    // Extract themes
    const themes = ai.extractJournalThemes(journals);
    
    // Get other wellness data for correlations
    const today = new Date();
    const startDate = format(subDays(today, 90), 'yyyy-MM-dd'); // last 90 days
    const endDate = format(today, 'yyyy-MM-dd');
    
    const moodsData = await storage.getMoods(userId, startDate, endDate);
    const sleepData = await storage.getSleep(userId, startDate, endDate);
    const activityData = await storage.getActivity(userId, startDate, endDate);
    
    // Find correlations
    const correlations = ai.findJournalCorrelations(
      moodsData.moods,
      sleepData.sleep,
      activityData.activity,
      journals
    );
    
    // Update or create insights record
    const existingInsights = await db.query.journalInsights.findFirst({
      where: eq(journalInsights.userId, userId)
    });
    
    if (existingInsights) {
      await db.update(journalInsights)
        .set({
          themes,
          correlations,
          updatedAt: new Date()
        })
        .where(eq(journalInsights.userId, userId));
    } else {
      await db.insert(journalInsights).values({
        userId,
        themes,
        correlations,
        createdAt: new Date(),
        updatedAt: new Date()
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
    // Get recent user data (last 365 days)
    const today = new Date();
    const startDate = format(subDays(today, 365), 'yyyy-MM-dd');
    const endDate = format(today, 'yyyy-MM-dd');
    
    const moodsData = await storage.getMoods(userId, startDate, endDate);
    const sleepData = await storage.getSleep(userId, startDate, endDate);
    const activityData = await storage.getActivity(userId, startDate, endDate);
    const journals = await storage.getJournalEntries(userId, 365);
    
    // Check for achievements
    const newAchievements = ai.checkAchievements(
      moodsData.moods,
      sleepData.sleep,
      activityData.activity,
      journals
    );
    
    // Get existing achievements
    const existingAchievements = await db.query.userAchievements.findMany({
      where: eq(userAchievements.userId, userId)
    });
    
    const existingIds = existingAchievements.map(a => a.achievementId);
    
    // Insert new achievements
    for (const achievementId of newAchievements) {
      if (!existingIds.includes(achievementId)) {
        await db.insert(userAchievements).values({
          userId,
          achievementId,
          achievedAt: new Date()
        });
      }
    }
  } catch (error) {
    console.error("Error checking achievements:", error);
  }
}