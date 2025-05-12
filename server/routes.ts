import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import * as storage from "./storage";
import * as ocr from "./ocr";
import * as ai from "./ai";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";
import { db } from "@db";
import { format, startOfWeek, endOfWeek, subDays } from "date-fns";

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Mock user ID for demonstration (in a real app, this would come from auth)
const MOCK_USER_ID = 1;

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // === Journal Routes ===
  
  // Get journal entries
  app.get("/api/journal/entries", async (_req, res) => {
    try {
      const entries = await storage.getJournalEntries(MOCK_USER_ID);
      res.json({ entries });
    } catch (error) {
      console.error("Error fetching journal entries:", error);
      res.status(500).json({ message: "Failed to fetch journal entries" });
    }
  });
  
  // Add manual journal entry
  app.post("/api/journal/entry", async (req, res) => {
    try {
      const { content, mood, sleep, activities, date } = req.body;
      
      // Create journal entry
      const formattedDate = date || new Date().toISOString().split('T')[0];
      
      const journal = await storage.insertJournal({
        userId: MOCK_USER_ID,
        content,
        date: formattedDate,
        imageUrl: null
      });
      
      // Create mood entry if provided
      if (typeof mood === 'number') {
        await storage.insertMood({
          userId: MOCK_USER_ID,
          value: mood,
          date: formattedDate
        });
      }
      
      // Create sleep entry if provided
      if (typeof sleep === 'number') {
        await storage.insertSleep({
          userId: MOCK_USER_ID,
          hours: sleep,
          date: formattedDate
        });
      }
      
      // Create activity entry if activities provided
      if (activities && activities.length > 0) {
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
          date: formattedDate
        });
      }
      
      // Generate journal insights
      await updateJournalInsights(MOCK_USER_ID);
      
      // Check for new achievements
      await checkAndUpdateAchievements(MOCK_USER_ID);
      
      res.json({ 
        success: true, 
        message: "Journal entry added successfully",
        journal
      });
    } catch (error) {
      console.error("Error adding journal entry:", error);
      res.status(500).json({ message: "Failed to add journal entry" });
    }
  });
  
  // Get last journal upload date
  app.get("/api/journal/last-upload", async (_req, res) => {
    try {
      const lastUpload = await storage.getLastJournalUpload(MOCK_USER_ID);
      res.json(lastUpload);
    } catch (error) {
      console.error("Error fetching last journal upload:", error);
      res.status(500).json({ message: "Failed to fetch last journal upload" });
    }
  });
  
  // Upload and process journal image
  app.post("/api/journal/upload", upload.single("journal"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      // Save uploaded image to temp file
      const imagePath = ocr.saveUploadedImage(
        req.file.buffer, 
        req.file.originalname
      );
      
      // Perform OCR
      const ocrResult = await ocr.performOCR(imagePath);
      
      if (!ocrResult.success) {
        ocr.cleanupImage(imagePath);
        return res.status(500).json({ message: ocrResult.error || "OCR processing failed" });
      }
      
      // Extract structured data from OCR text
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
        // This is very rough - in a real app we'd use a more sophisticated method
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
  
  // Get journal insights
  app.get("/api/journal/insights", async (_req, res) => {
    try {
      const insights = await storage.getJournalInsights(MOCK_USER_ID);
      res.json(insights);
    } catch (error) {
      console.error("Error fetching journal insights:", error);
      res.status(500).json({ message: "Failed to fetch journal insights" });
    }
  });
  
  // === Mood Routes ===
  
  // Get mood data for a date range
  app.get("/api/mood", async (req, res) => {
    try {
      const startDate = req.query.startDate as string || format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const endDate = req.query.endDate as string || format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      
      const moodData = await storage.getMoods(MOCK_USER_ID, startDate, endDate);
      res.json(moodData);
    } catch (error) {
      console.error("Error fetching mood data:", error);
      res.status(500).json({ message: "Failed to fetch mood data" });
    }
  });
  
  // Get monthly mood data
  app.get("/api/mood/monthly", async (req, res) => {
    try {
      const startDate = req.query.startDate as string || format(subDays(new Date(), 30), 'yyyy-MM-dd');
      const endDate = req.query.endDate as string || format(new Date(), 'yyyy-MM-dd');
      
      const moodData = await storage.getMonthlyMoodData(MOCK_USER_ID, startDate, endDate);
      res.json(moodData);
    } catch (error) {
      console.error("Error fetching monthly mood data:", error);
      res.status(500).json({ message: "Failed to fetch monthly mood data" });
    }
  });
  
  // Log new mood entry
  app.post("/api/mood", async (req, res) => {
    try {
      const { value, date } = req.body;
      
      if (typeof value !== 'number' || value < 0 || value > 100) {
        return res.status(400).json({ message: "Invalid mood value. Must be between 0 and 100." });
      }
      
      const moodEntry = await storage.insertMood({
        userId: MOCK_USER_ID,
        value,
        date: date || new Date().toISOString().split('T')[0]
      });
      
      // Check for achievements after adding mood
      await checkAndUpdateAchievements(MOCK_USER_ID);
      
      res.json({ success: true, mood: moodEntry });
    } catch (error) {
      console.error("Error saving mood:", error);
      res.status(500).json({ message: "Failed to save mood" });
    }
  });
  
  // === Sleep Routes ===
  
  // Get sleep data for a date range
  app.get("/api/sleep", async (req, res) => {
    try {
      const startDate = req.query.startDate as string || format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const endDate = req.query.endDate as string || format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      
      const sleepData = await storage.getWeeklySleep(MOCK_USER_ID, endDate);
      res.json(sleepData);
    } catch (error) {
      console.error("Error fetching sleep data:", error);
      res.status(500).json({ message: "Failed to fetch sleep data" });
    }
  });
  
  // Get monthly sleep data
  app.get("/api/sleep/monthly", async (req, res) => {
    try {
      const startDate = req.query.startDate as string || format(subDays(new Date(), 30), 'yyyy-MM-dd');
      const endDate = req.query.endDate as string || format(new Date(), 'yyyy-MM-dd');
      
      const sleepData = await storage.getMonthlySleepData(MOCK_USER_ID, startDate, endDate);
      res.json(sleepData);
    } catch (error) {
      console.error("Error fetching monthly sleep data:", error);
      res.status(500).json({ message: "Failed to fetch monthly sleep data" });
    }
  });
  
  // Log new sleep entry
  app.post("/api/sleep", async (req, res) => {
    try {
      const { hours, date } = req.body;
      
      if (typeof hours !== 'number' || hours < 0 || hours > 24) {
        return res.status(400).json({ message: "Invalid sleep hours. Must be between 0 and 24." });
      }
      
      const sleepEntry = await storage.insertSleep({
        userId: MOCK_USER_ID,
        hours,
        date: date || new Date().toISOString().split('T')[0]
      });
      
      // Check for achievements after adding sleep
      await checkAndUpdateAchievements(MOCK_USER_ID);
      
      res.json({ success: true, sleep: sleepEntry });
    } catch (error) {
      console.error("Error saving sleep:", error);
      res.status(500).json({ message: "Failed to save sleep" });
    }
  });
  
  // === Activity Routes ===
  
  // Get activity data for a date range
  app.get("/api/activity", async (req, res) => {
    try {
      const startDate = req.query.startDate as string || format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const endDate = req.query.endDate as string || format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      
      const activityData = await storage.getWeeklyActivity(MOCK_USER_ID, endDate);
      res.json(activityData);
    } catch (error) {
      console.error("Error fetching activity data:", error);
      res.status(500).json({ message: "Failed to fetch activity data" });
    }
  });
  
  // Get monthly activity data
  app.get("/api/activity/monthly", async (req, res) => {
    try {
      const startDate = req.query.startDate as string || format(subDays(new Date(), 30), 'yyyy-MM-dd');
      const endDate = req.query.endDate as string || format(new Date(), 'yyyy-MM-dd');
      
      const activityData = await storage.getMonthlyActivityData(MOCK_USER_ID, startDate, endDate);
      res.json(activityData);
    } catch (error) {
      console.error("Error fetching monthly activity data:", error);
      res.status(500).json({ message: "Failed to fetch monthly activity data" });
    }
  });
  
  // Log new activity entry
  app.post("/api/activity", async (req, res) => {
    try {
      const { steps, date } = req.body;
      
      if (typeof steps !== 'number' || steps < 0) {
        return res.status(400).json({ message: "Invalid steps value. Must be a positive number." });
      }
      
      const activityEntry = await storage.insertActivity({
        userId: MOCK_USER_ID,
        steps,
        date: date || new Date().toISOString().split('T')[0]
      });
      
      // Check for achievements after adding activity
      await checkAndUpdateAchievements(MOCK_USER_ID);
      
      res.json({ success: true, activity: activityEntry });
    } catch (error) {
      console.error("Error saving activity:", error);
      res.status(500).json({ message: "Failed to save activity" });
    }
  });
  
  // === Tips Routes ===
  
  // Get personalized tips
  app.get("/api/tips", async (_req, res) => {
    try {
      // Get recent data to generate personalized tips
      const today = new Date();
      const oneMonthAgo = subDays(today, 30);
      const startDate = format(oneMonthAgo, 'yyyy-MM-dd');
      const endDate = format(today, 'yyyy-MM-dd');
      
      // Fetch user data
      const { moods } = await storage.getMoods(MOCK_USER_ID, startDate, endDate);
      const { sleep } = await storage.getSleep(MOCK_USER_ID, startDate, endDate);
      const { activity } = await storage.getActivity(MOCK_USER_ID, startDate, endDate);
      const journals = await storage.getJournalEntries(MOCK_USER_ID, 10);
      
      // Generate personalized tips
      const personalizedTips = ai.generatePersonalizedTips(MOCK_USER_ID, moods, sleep, activity, journals);
      
      // If we don't have enough personalized tips, get some generic ones from the database
      if (personalizedTips.length < 3) {
        const additionalTips = await storage.getTips(MOCK_USER_ID, 3 - personalizedTips.length);
        res.json({ tips: [...personalizedTips, ...additionalTips] });
      } else {
        res.json({ tips: personalizedTips });
      }
    } catch (error) {
      console.error("Error fetching tips:", error);
      res.status(500).json({ message: "Failed to fetch tips" });
    }
  });
  
  // Get all tips
  app.get("/api/tips/all", async (_req, res) => {
    try {
      const tipsData = await storage.getAllTips();
      res.json(tipsData);
    } catch (error) {
      console.error("Error fetching all tips:", error);
      res.status(500).json({ message: "Failed to fetch all tips" });
    }
  });
  
  // === Achievements Routes ===
  
  // Get achievements for dashboard
  app.get("/api/achievements", async (_req, res) => {
    try {
      const achievements = await storage.getAchievements(MOCK_USER_ID);
      res.json({ achievements });
    } catch (error) {
      console.error("Error fetching achievements:", error);
      res.status(500).json({ message: "Failed to fetch achievements" });
    }
  });
  
  // Get all achievements
  app.get("/api/achievements/all", async (_req, res) => {
    try {
      const achievementsData = await storage.getAllAchievements(MOCK_USER_ID);
      res.json(achievementsData);
    } catch (error) {
      console.error("Error fetching all achievements:", error);
      res.status(500).json({ message: "Failed to fetch all achievements" });
    }
  });
  
  // === Settings Routes ===
  
  // Get user settings
  app.get("/api/settings", async (_req, res) => {
    try {
      const userSettings = await storage.getSettings(MOCK_USER_ID);
      
      if (!userSettings) {
        return res.status(404).json({ message: "Settings not found" });
      }
      
      // Format settings for the frontend
      const formattedSettings = {
        profile: {
          name: userSettings.name,
          email: userSettings.email,
        },
        preferences: {
          weeklyReminders: userSettings.weeklyReminders,
          journalPrompts: userSettings.journalPrompts,
          uploadDay: userSettings.uploadDay,
        },
        goals: {
          sleepHours: userSettings.sleepGoal,
          dailySteps: userSettings.stepsGoal,
          journalFrequency: userSettings.journalFrequency,
        }
      };
      
      res.json(formattedSettings);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });
  
  // Update user settings
  app.put("/api/settings", async (req, res) => {
    try {
      const { profile, preferences, goals } = req.body;
      
      if (!profile || !preferences || !goals) {
        return res.status(400).json({ message: "Invalid settings data" });
      }
      
      // Format settings for the database
      const settingsData = {
        name: profile.name,
        email: profile.email,
        weeklyReminders: preferences.weeklyReminders,
        journalPrompts: preferences.journalPrompts,
        uploadDay: preferences.uploadDay,
        sleepGoal: goals.sleepHours,
        stepsGoal: goals.dailySteps,
        journalFrequency: goals.journalFrequency,
      };
      
      // Update settings
      const updatedSettings = await storage.updateSettings(MOCK_USER_ID, settingsData);
      
      res.json({ success: true, settings: updatedSettings });
    } catch (error) {
      console.error("Error updating settings:", error);
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Helper Functions

/**
 * Updates journal insights based on recent user data
 */
async function updateJournalInsights(userId: number): Promise<void> {
  try {
    // Get recent data
    const today = new Date();
    const oneMonthAgo = subDays(today, 30);
    const startDate = format(oneMonthAgo, 'yyyy-MM-dd');
    const endDate = format(today, 'yyyy-MM-dd');
    
    // Fetch user data
    const { moods } = await storage.getMoods(userId, startDate, endDate);
    const { sleep } = await storage.getSleep(userId, startDate, endDate);
    const { activity } = await storage.getActivity(userId, startDate, endDate);
    const journals = await storage.getJournalEntries(userId, 10);
    
    // Extract themes and correlations
    const themes = ai.extractJournalThemes(journals);
    const correlations = ai.findJournalCorrelations(moods, sleep, activity, journals);
    
    // Check if insights already exist
    const existingInsights = await db
      .select()
      .from(schema.journalInsights)
      .where(eq(schema.journalInsights.userId, userId));
    
    if (existingInsights.length > 0) {
      // Update existing insights
      await db
        .update(schema.journalInsights)
        .set({
          themes,
          correlations,
          updatedAt: new Date().toISOString()
        })
        .where(eq(schema.journalInsights.userId, userId));
    } else {
      // Create new insights
      await storage.insertJournalInsight({
        userId,
        themes,
        correlations
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
    // Get user data
    const today = new Date();
    const oneMonthAgo = subDays(today, 30);
    const startDate = format(oneMonthAgo, 'yyyy-MM-dd');
    const endDate = format(today, 'yyyy-MM-dd');
    
    const { moods } = await storage.getMoods(userId, startDate, endDate);
    const { sleep } = await storage.getSleep(userId, startDate, endDate);
    const { activity } = await storage.getActivity(userId, startDate, endDate);
    const journals = await storage.getJournalEntries(userId, 10);
    
    // Check for new achievements
    const achievedIds = ai.checkAchievements(moods, sleep, activity, journals);
    
    if (achievedIds.length === 0) {
      return;
    }
    
    // Get current achievements
    const { achievements } = await storage.getAllAchievements(userId);
    
    // Update user achievements that are newly completed
    for (const achievedId of achievedIds) {
      const achievement = achievements.find(a => a.id === achievedId);
      
      if (achievement && !achievement.unlocked) {
        await storage.updateUserAchievement(userId, achievedId, {
          unlocked: true,
          unlockedAt: new Date().toISOString()
        });
      }
    }
  } catch (error) {
    console.error("Error checking achievements:", error);
  }
}
