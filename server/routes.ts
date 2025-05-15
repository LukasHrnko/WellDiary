import express, { type Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import * as storage from "./storage";
import * as ai from "./ai";
import * as trocr from "./simple-tesseract";
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
  
  app.get("/api/journal/entries", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Uživatel není přihlášen" });
      }
      
      const userId = req.user.id;
      const entries = await storage.getJournalEntries(userId, 90);
      res.json({ entries });
    } catch (error) {
      console.error("Error fetching journal entries:", error);
      res.status(500).json({ message: "Failed to fetch journal entries" });
    }
  });
  
  app.get("/api/journal/last-upload", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Uživatel není přihlášen" });
      }
      
      const userId = req.user.id;
      
      // Zde by měla být funkce getLastJournalEntry, ale dle chyby neexistuje
      // Použijeme náhradní řešení pro získání posledního záznamu
      const entries = await storage.getJournalEntries(userId, 1);
      const lastEntry = entries && entries.length > 0 ? entries[0] : null;
      
      res.json({ lastEntry });
    } catch (error) {
      console.error("Error fetching last journal entry:", error);
      res.status(500).json({ message: "Failed to fetch last journal entry" });
    }
  });
  
  // Endpoint pro aktualizaci detailů deníkového záznamu
  app.post("/api/journal/entry", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Uživatel není přihlášen" });
      }
      
      const { journalId, moodValue, sleepHours, steps } = req.body;
      
      if (!journalId) {
        return res.status(400).json({ message: "Chybí ID deníkového záznamu" });
      }
      
      // Získat deníkový záznam
      const entries = await storage.getJournalEntries(req.user.id);
      const journal = entries.find(entry => entry.id === journalId);
      
      if (!journal) {
        return res.status(404).json({ message: "Deníkový záznam nenalezen" });
      }
      
      if (journal.userId !== req.user.id) {
        return res.status(403).json({ message: "Nemáte oprávnění k tomuto záznamu" });
      }
      
      // Uložit metadata
      if (sleepHours !== undefined) {
        try {
          await storage.insertSleep({
            userId: req.user.id,
            hours: sleepHours,
            date: journal.date
          });
        } catch (err) {
          console.error("Nepodařilo se uložit data o spánku:", err);
        }
      }
      
      if (moodValue !== undefined) {
        try {
          await storage.insertMood({
            userId: req.user.id,
            value: moodValue,
            date: journal.date
          });
        } catch (err) {
          console.error("Nepodařilo se uložit data o náladě:", err);
        }
      }
      
      if (steps !== undefined) {
        try {
          await storage.insertActivity({
            userId: req.user.id,
            steps: steps,
            date: journal.date
          });
        } catch (err) {
          console.error("Nepodařilo se uložit data o aktivitě:", err);
        }
      }
      
      // Aktualizovat analýzy a insighty
      updateJournalInsights(req.user.id).catch(err => {
        console.error("Nepodařilo se aktualizovat insighty:", err);
      });
      
      // Check for new achievements
      checkAndUpdateAchievements(req.user.id).catch(err => 
        console.error("Failed to check achievements:", err)
      );
      
      res.json({ 
        success: true, 
        journal,
        message: "Deníkový záznam byl úspěšně aktualizován" 
      });
    } catch (error) {
      console.error('Chyba při aktualizaci deníkového záznamu:', error);
      res.status(500).json({ 
        success: false, 
        message: "Neočekávaná chyba při aktualizaci deníkového záznamu"
      });
    }
  });
  
  app.post("/api/journal/create", async (req: Request, res: Response) => {
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
      const userId1 = req.isAuthenticated() ? req.user.id : MOCK_USER_ID;
      checkAndUpdateAchievements(userId1).catch(err => 
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
      
      // Kontrola přihlášení uživatele
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Uživatel není přihlášen" });
      }
      
      const userId = req.user.id;
      
      // Extrakt dodatečných dat z formuláře
      const mood = req.body.mood ? parseInt(req.body.mood) : undefined;
      const sleepHours = req.body.sleepHours ? parseFloat(req.body.sleepHours) : undefined;
      const steps = req.body.steps ? parseInt(req.body.steps) : undefined;
      const activities = req.body.activities ? req.body.activities.split(',').map((a: string) => a.trim()) : undefined;
      
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
        userId,
        content: journalData.content,
        date,
        imageUrl: null
      });
      
      // Create mood entry - preferuj hodnotu z formuláře, pokud existuje
      const finalMood = mood !== undefined ? mood : journalData.mood;
      if (finalMood !== undefined) {
        await storage.insertMood({
          userId,
          value: finalMood,
          date
        });
      }
      
      // Create sleep entry - preferuj hodnotu z formuláře, pokud existuje
      const finalSleepHours = sleepHours !== undefined ? sleepHours : journalData.sleep;
      if (finalSleepHours !== undefined) {
        await storage.insertSleep({
          userId,
          hours: finalSleepHours,
          date
        });
      }
      
      // Create activity entry - preferuj hodnotu z formuláře, pokud existuje
      const finalActivities = activities || (journalData.activities && journalData.activities.length > 0 ? journalData.activities : null);
      if (finalActivities) {
        // Použij kroky z formuláře, jinak generuj hodnotu
        const finalSteps = steps !== undefined ? steps : Math.floor(Math.random() * 3000) + 5000;
        await storage.insertActivity({
          userId,
          steps: finalSteps,
          date
        });
      }
      
      // Clean up the temporary image
      trocr.cleanupImage(imagePath);
      
      // Update insights asynchronously
      updateJournalInsights(userId).catch(err => 
        console.error("Failed to update journal insights:", err)
      );
      
      // Check for new achievements
      checkAndUpdateAchievements(userId).catch(err => 
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
      
      // Kontrola přihlášení uživatele
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Uživatel není přihlášen" });
      }
      
      const userId = req.user.id;
      
      // Extrakt dodatečných dat z formuláře
      const mood = req.body.mood ? parseInt(req.body.mood) : undefined;
      const sleepHours = req.body.sleepHours ? parseFloat(req.body.sleepHours) : undefined;
      const steps = req.body.steps ? parseInt(req.body.steps) : undefined;
      const activities = req.body.activities ? req.body.activities.split(',').map((a: string) => a.trim()) : undefined;
      
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
        userId,
        content: journalData.content,
        date,
        imageUrl: null
      });
      
      // Create mood entry - preferuj hodnotu z formuláře, pokud existuje
      const finalMood = mood !== undefined ? mood : journalData.mood;
      if (finalMood !== undefined) {
        await storage.insertMood({
          userId,
          value: finalMood,
          date
        });
      }
      
      // Create sleep entry - preferuj hodnotu z formuláře, pokud existuje
      const finalSleepHours = sleepHours !== undefined ? sleepHours : journalData.sleep;
      if (finalSleepHours !== undefined) {
        await storage.insertSleep({
          userId,
          hours: finalSleepHours,
          date
        });
      }
      
      // Create activity entry - preferuj hodnotu z formuláře, pokud existuje
      const finalActivities = activities || (journalData.activities && journalData.activities.length > 0 ? journalData.activities : null);
      if (finalActivities) {
        // Použij kroky z formuláře, jinak generuj hodnotu
        const finalSteps = steps !== undefined ? steps : Math.floor(Math.random() * 3000) + 5000;
        await storage.insertActivity({
          userId,
          steps: finalSteps,
          date
        });
      }
      
      // Clean up the temporary image
      trocr.cleanupImage(imagePath);
      
      // Update insights asynchronously
      updateJournalInsights(userId).catch(err => 
        console.error("Failed to update journal insights:", err)
      );
      
      // Check for new achievements
      checkAndUpdateAchievements(userId).catch(err => 
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
  
  app.get("/api/activity", async (req: Request, res: Response) => {
    try {
      // Get all activity data
      const today = new Date();
      const startDate = format(subDays(today, 30), 'yyyy-MM-dd'); // last 30 days
      const endDate = format(today, 'yyyy-MM-dd');
      
      // Use user ID if authenticated, otherwise fall back to MOCK_USER_ID
      const userId = req.isAuthenticated() ? req.user.id : MOCK_USER_ID;
      
      const data = await storage.getActivity(userId, startDate, endDate);
      
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
      // Kontrola přihlášení uživatele
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Uživatel není přihlášen" });
      }
      
      const { steps, date } = req.body;
      
      if (steps === undefined || steps < 0) {
        return res.status(400).json({ message: "Invalid steps value" });
      }
      
      const safeDate = safeParseDate(date);
      
      const activity = await storage.insertActivity({
        userId: req.user.id,
        steps,
        date: safeDate
      });
      
      // Check for new achievements
      checkAndUpdateAchievements(req.user.id).catch(err => 
        console.error("Failed to check achievements:", err)
      );
      
      res.json({ activity });
    } catch (error) {
      console.error("Error creating activity entry:", error);
      res.status(500).json({ message: "Failed to create activity entry" });
    }
  });
  
  app.get("/api/activity/monthly", async (req: Request, res: Response) => {
    try {
      // Get monthly activity data
      const today = new Date();
      const startDate = new Date(today.getFullYear(), today.getMonth() - 5, 1);
      const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      
      const formattedStartDate = format(startDate, 'yyyy-MM-dd');
      const formattedEndDate = format(endDate, 'yyyy-MM-dd');
      
      // Use user ID if authenticated
      const userId = req.isAuthenticated() ? req.user.id : MOCK_USER_ID;
      
      const data = await storage.getMonthlyActivityData(
        userId, 
        formattedStartDate, 
        formattedEndDate
      );
      
      res.json({ monthlyData: data });
    } catch (error) {
      console.error("Error fetching monthly activity data:", error);
      res.status(500).json({ message: "Failed to fetch monthly activity data" });
    }
  });
  
  // === Mood Routes ===
  
  app.get("/api/mood", async (req: Request, res: Response) => {
    try {
      // Get all mood data
      const today = new Date();
      const startDate = format(subDays(today, 30), 'yyyy-MM-dd'); // last 30 days
      const endDate = format(today, 'yyyy-MM-dd');
      
      // Use user ID if authenticated, otherwise fall back to MOCK_USER_ID
      const userId = req.isAuthenticated() ? req.user.id : MOCK_USER_ID;
      
      const data = await storage.getMoods(userId, startDate, endDate);
      
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
      // Kontrola přihlášení uživatele
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Uživatel není přihlášen" });
      }
      
      const { value, date } = req.body;
      
      if (value === undefined || value < 1 || value > 10) {
        return res.status(400).json({ message: "Invalid mood value. Must be between 1 and 10." });
      }
      
      const safeDate = safeParseDate(date);
      
      const mood = await storage.insertMood({
        userId: req.user.id,
        value,
        date: safeDate
      });
      
      // Check for new achievements
      checkAndUpdateAchievements(req.user.id).catch(err => 
        console.error("Failed to check achievements:", err)
      );
      
      res.json({ mood });
    } catch (error) {
      console.error("Error creating mood entry:", error);
      res.status(500).json({ message: "Failed to create mood entry" });
    }
  });
  
  app.get("/api/mood/monthly", async (req: Request, res: Response) => {
    try {
      // Get monthly mood data
      const today = new Date();
      const startDate = new Date(today.getFullYear(), today.getMonth() - 5, 1);
      const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      
      const formattedStartDate = format(startDate, 'yyyy-MM-dd');
      const formattedEndDate = format(endDate, 'yyyy-MM-dd');
      
      // Use user ID if authenticated
      const userId = req.isAuthenticated() ? req.user.id : MOCK_USER_ID;
      
      const data = await storage.getMonthlyMoodData(
        userId, 
        formattedStartDate, 
        formattedEndDate
      );
      
      res.json({ monthlyData: data });
    } catch (error) {
      console.error("Error fetching monthly mood data:", error);
      res.status(500).json({ message: "Failed to fetch monthly mood data" });
    }
  });
  
  // === Sleep Routes ===
  
  app.get("/api/sleep", async (req: Request, res: Response) => {
    try {
      // Get all sleep data
      const today = new Date();
      const startDate = format(subDays(today, 30), 'yyyy-MM-dd'); // last 30 days
      const endDate = format(today, 'yyyy-MM-dd');
      
      // Use user ID if authenticated, otherwise fall back to MOCK_USER_ID
      const userId = req.isAuthenticated() ? req.user.id : MOCK_USER_ID;
      
      const data = await storage.getSleep(userId, startDate, endDate);
      
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
      // Kontrola přihlášení uživatele
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Uživatel není přihlášen" });
      }
      
      const { hours, date } = req.body;
      
      if (hours === undefined || hours < 0 || hours > 24) {
        return res.status(400).json({ message: "Invalid sleep hours. Must be between 0 and 24." });
      }
      
      const safeDate = safeParseDate(date);
      
      const sleep = await storage.insertSleep({
        userId: req.user.id,
        hours,
        date: safeDate
      });
      
      // Check for new achievements
      checkAndUpdateAchievements(req.user.id).catch(err => 
        console.error("Failed to check achievements:", err)
      );
      
      res.json({ sleep });
    } catch (error) {
      console.error("Error creating sleep entry:", error);
      res.status(500).json({ message: "Failed to create sleep entry" });
    }
  });
  
  app.get("/api/sleep/monthly", async (req: Request, res: Response) => {
    try {
      // Get monthly sleep data
      const today = new Date();
      const startDate = new Date(today.getFullYear(), today.getMonth() - 5, 1);
      const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      
      const formattedStartDate = format(startDate, 'yyyy-MM-dd');
      const formattedEndDate = format(endDate, 'yyyy-MM-dd');
      
      // Use user ID if authenticated
      const userId = req.isAuthenticated() ? req.user.id : MOCK_USER_ID;
      
      const data = await storage.getMonthlySleepData(userId, formattedStartDate, formattedEndDate);
      
      res.json({ monthlyData: data });
    } catch (error) {
      console.error("Error fetching monthly sleep data:", error);
      res.status(500).json({ message: "Failed to fetch monthly sleep data" });
    }
  });
  
  // === Tips and Achievements Routes ===
  
  app.get("/api/tips", async (req: Request, res: Response) => {
    try {
      // Get recent user data
      const today = new Date();
      const startDate = format(subDays(today, 30), 'yyyy-MM-dd'); // last 30 days
      const endDate = format(today, 'yyyy-MM-dd');
      
      // Use user ID if authenticated, otherwise fall back to MOCK_USER_ID
      const userId = req.isAuthenticated() ? req.user.id : MOCK_USER_ID;
      
      const moodsData = await storage.getMoods(userId, startDate, endDate);
      const sleepData = await storage.getSleep(userId, startDate, endDate);
      const activityData = await storage.getActivity(userId, startDate, endDate);
      const journals = await storage.getJournalEntries(userId, 30);
      
      // Generate personalized tips
      const tips = ai.generatePersonalizedTips(
        userId,
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
  
  app.get("/api/achievements", async (req: Request, res: Response) => {
    try {
      // Use user ID if authenticated, otherwise fall back to MOCK_USER_ID
      const userId = req.isAuthenticated() ? req.user.id : MOCK_USER_ID;
      
      // Get user achievements
      const userAchievementsData = await db.query.userAchievements.findMany({
        where: eq(userAchievements.userId, userId)
      });
      
      // Get all possible achievements
      const allAchievements = await db.query.achievements.findMany();
      
      // Map user achievements to include all needed data
      const achievements = allAchievements.map(achievement => {
        const userAchievement = userAchievementsData.find(ua => ua.achievementId === achievement.id);
        
        return {
          id: achievement.id,
          title: achievement.title,
          description: achievement.description,
          category: achievement.category,
          icon: achievement.icon,
          goal: achievement.goal,
          unlocked: userAchievement?.unlocked || false,
          unlockedAt: userAchievement?.unlockedAt || null,
          progress: userAchievement?.progress || 0
        };
      });
      
      // Get unique categories
      const categoriesSet = new Set<string>();
      allAchievements.forEach(a => {
        if (a.category) categoriesSet.add(a.category);
      });
      const categories = Array.from(categoriesSet);
      
      res.json({ achievements, categories });
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
          unlocked: true,
          unlockedAt: new Date().toISOString()
        });
      }
    }
  } catch (error) {
    console.error("Error checking achievements:", error);
  }
}