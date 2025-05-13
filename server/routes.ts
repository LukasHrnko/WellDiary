import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import * as storage from "./storage";
import * as ocr from "./ocr";
import * as paddleocr from "./paddleocr";
import * as webaiocr from "./webai-ocr";
import * as ai from "./ai";
import * as htr from "./enhanced-htr";
import * as handwritingRecognition from "./handwriting-recognition";
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
  
  // API pro rozpoznávání rukopisných deníkových záznamů
  // Nový endpoint pro handwriting.js - specializovaný pro rukopisný text
  app.post("/api/journal/upload/handwriting", upload.single("journal"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded", success: false });
      }
      
      // Uložení nahraného souboru
      const imagePath = handwritingRecognition.saveUploadedImage(
        req.file.buffer, 
        req.file.originalname
      );
      
      console.log("Starting handwriting.js recognition process");
      
      // Rozpoznávání rukopisu pomocí specializované knihovny
      const hwResult = await handwritingRecognition.performHandwritingRecognition(imagePath);
      
      if (!hwResult.success) {
        handwritingRecognition.cleanupImage(imagePath);
        return res.status(500).json({ 
          message: hwResult.error || "Handwriting recognition failed",
          success: false
        });
      }
      
      console.log("Handwriting.js recognition complete. Confidence:", hwResult.confidence);
      
      // Extrakce strukturovaných dat
      const journalData = ocr.extractJournalData(hwResult.text);
      
      // Bezpečné parsování data
      const date = safeParseDate(journalData.date);
      
      // Vytvoření záznamu v deníku
      const journal = await storage.insertJournal({
        userId: MOCK_USER_ID,
        content: journalData.content,
        date,
        imageUrl: null
      });
      
      // Vytvoření záznamu nálady, pokud byl detekován
      if (journalData.mood !== undefined) {
        await storage.insertMood({
          userId: MOCK_USER_ID,
          value: journalData.mood,
          date
        });
      }
      
      // Vytvoření záznamu spánku, pokud byl detekován
      if (journalData.sleep !== undefined) {
        await storage.insertSleep({
          userId: MOCK_USER_ID,
          hours: journalData.sleep,
          date
        });
      }
      
      // Vytvoření záznamu aktivit
      if (journalData.activities && journalData.activities.length > 0) {
        // Výpočet kroků na základě zjištěných aktivit
        const hasExercise = journalData.activities.some(activity => 
          ["walk", "run", "gym", "exercise", "workout", "jog", "swim", "yoga"].some(term => 
            activity.toLowerCase().includes(term)
          )
        );
        
        const steps = hasExercise ? Math.floor(Math.random() * 5000) + 5000 : Math.floor(Math.random() * 3000) + 2000;
        
        await storage.insertActivity({
          userId: MOCK_USER_ID,
          steps,
          date
        });
      }
      
      // Aktualizovat insighty na základě nového deníkového záznamu
      await updateJournalInsights(MOCK_USER_ID);
      
      // Kontrola nových ocenění
      await checkAndUpdateAchievements(MOCK_USER_ID);
      
      // Vyčištění nahraného souboru
      handwritingRecognition.cleanupImage(imagePath);
      
      res.status(200).json({
        message: "Journal entry created successfully",
        journalId: journal.id,
        text: hwResult.text,
        confidence: hwResult.confidence,
        success: true
      });
    } catch (error) {
      console.error("Error handling handwriting recognition upload:", error);
      res.status(500).json({ 
        message: "Server error processing handwriting recognition", 
        success: false 
      });
    }
  });
  
  app.post("/api/journal/upload/enhanced-htr", upload.single("journal"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      // Dynamický import modulu pro vylepšené HTR
      const enhancedHtr = await import('./enhanced-htr');
      
      // Uložení nahraného souboru
      const imagePath = enhancedHtr.saveUploadedImage(
        req.file.buffer, 
        req.file.originalname
      );
      
      console.log("Starting enhanced HTR processing for handwritten text");
      
      // Pokročilé rozpoznávání rukopisu s více průchody
      const htrResult = await enhancedHtr.performEnhancedHTR(imagePath);
      
      if (!htrResult.success) {
        enhancedHtr.cleanupImage(imagePath);
        return res.status(500).json({ 
          message: htrResult.error || "Enhanced HTR processing failed",
          success: false
        });
      }
      
      console.log("Enhanced HTR processing complete. Confidence:", htrResult.confidence);
      
      // Extrakce strukturovaných dat
      const journalData = ocr.extractJournalData(htrResult.text);
      
      // Bezpečné parsování data
      const date = safeParseDate(journalData.date);
      
      // Vytvoření záznamu v deníku
      const journal = await storage.insertJournal({
        userId: MOCK_USER_ID,
        content: journalData.content,
        date,
        imageUrl: null
      });
      
      // Vytvoření záznamu nálady, pokud byl detekován
      if (journalData.mood !== undefined) {
        await storage.insertMood({
          userId: MOCK_USER_ID,
          value: journalData.mood,
          date
        });
      }
      
      // Vytvoření záznamu spánku, pokud byl detekován
      if (journalData.sleep !== undefined) {
        await storage.insertSleep({
          userId: MOCK_USER_ID,
          hours: journalData.sleep,
          date
        });
      }
      
      // Vytvoření záznamu aktivit
      if (journalData.activities && journalData.activities.length > 0) {
        // Výpočet kroků na základě zjištěných aktivit
        const hasExercise = journalData.activities.some(activity => 
          ["walk", "run", "gym", "exercise", "workout", "jog", "swim", "yoga"].some(term => 
            activity.toLowerCase().includes(term)
          )
        );
        
        const steps = hasExercise ? 
          Math.floor(Math.random() * 5000) + 5000 : 
          Math.floor(Math.random() * 3000) + 2000;
        
        await storage.insertActivity({
          userId: MOCK_USER_ID,
          steps,
          date
        });
      }
      
      // Vyčištění dočasného souboru
      enhancedHtr.cleanupImage(imagePath);
      
      // Aktualizace insights
      updateJournalInsights(MOCK_USER_ID).catch(err => 
        console.error("Failed to update journal insights:", err)
      );
      
      // Kontrola nových achievementů
      checkAndUpdateAchievements(MOCK_USER_ID).catch(err => 
        console.error("Failed to check achievements:", err)
      );
      
      // Úspěšná odpověď
      res.status(200).json({
        success: true,
        message: "Handwritten journal processed successfully with Enhanced HTR",
        journalId: journal.id,
        text: htrResult.text,
        confidence: htrResult.confidence,
        extractedData: {
          date: journalData.date,
          mood: journalData.mood,
          sleep: journalData.sleep,
          activities: journalData.activities
        }
      });
    } catch (error) {
      console.error("Enhanced HTR processing error:", error);
      res.status(500).json({ 
        message: "Failed to process handwritten journal with Enhanced HTR",
        success: false
      });
    }
  });
  
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
      
      // Create activity entries if extracted
      if (journalData.activities && journalData.activities.length > 0) {
        const activityCount = journalData.activities.length * 1000; // Simple calculation based on number of activities
        await storage.insertActivity({
          userId: MOCK_USER_ID,
          steps: activityCount,
          date
        });
      }
      
      // Clean up the temporary image
      webaiocr.cleanupImage(imagePath);
      
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
      console.error("Error processing journal with Web AI Toolkit OCR:", error);
      res.status(500).json({ message: "Failed to process journal with Web AI Toolkit OCR" });
    }
  });
      
  // Upload and process journal image with HTR (Handwritten Text Recognition)
  app.post("/api/journal/upload/htr", upload.single("journal"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      // Import HTR module dynamically to avoid loading TensorFlow unnecessarily
      const htr = await import('./htr');
      
      // Save uploaded image to temp file
      const imagePath = htr.saveUploadedImage(
        req.file.buffer, 
        req.file.originalname
      );
      
      console.log("Starting specialized HTR processing for handwritten text");
      
      // Perform HTR using TensorFlow + Tesseract
      const htrResult = await htr.performHTR(imagePath);
      
      if (!htrResult.success) {
        htr.cleanupImage(imagePath);
        return res.status(500).json({ message: htrResult.error || "HTR processing failed" });
      }
      
      console.log("HTR processing complete. Confidence:", htrResult.confidence);
      
      // Extract structured data from HTR text using the same extraction logic
      const journalData = ocr.extractJournalData(htrResult.text);
      
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
      htr.cleanupImage(imagePath);
      
      // Generate journal insights
      await updateJournalInsights(MOCK_USER_ID);
      
      // Check for new achievements
      await checkAndUpdateAchievements(MOCK_USER_ID);
      
      res.json({ 
        success: true, 
        message: "Journal processed successfully with HTR (Handwritten Text Recognition)",
        journalId: journal.id,
        text: htrResult.text,
        confidence: htrResult.confidence
      });
    } catch (error) {
      console.error("HTR processing error:", error);
      res.status(500).json({ message: "Failed to process handwritten journal with HTR" });
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

  // Get monthly mood data
  app.get("/api/mood/monthly", async (_req: Request, res: Response) => {
    try {
      const now = new Date();
      const startDate = format(new Date(now.getFullYear(), now.getMonth() - 2, 1), "yyyy-MM-dd");
      const endDate = format(now, "yyyy-MM-dd");
      
      const monthlyData = await storage.getMonthlyMoodData(MOCK_USER_ID, startDate, endDate);
      
      res.json(monthlyData);
    } catch (error) {
      console.error("Error fetching monthly mood data:", error);
      res.status(500).json({ message: "Error fetching monthly mood data" });
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
  
  // Get monthly sleep data
  app.get("/api/sleep/monthly", async (_req: Request, res: Response) => {
    try {
      const now = new Date();
      const startDate = format(new Date(now.getFullYear(), now.getMonth() - 2, 1), "yyyy-MM-dd");
      const endDate = format(now, "yyyy-MM-dd");
      
      const monthlyData = await storage.getMonthlySleepData(MOCK_USER_ID, startDate, endDate);
      
      res.json(monthlyData);
    } catch (error) {
      console.error("Error fetching monthly sleep data:", error);
      res.status(500).json({ message: "Error fetching monthly sleep data" });
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
      
      // Add step goal
      const goal = 10000; // Default step goal
      
      res.json({ ...activityData, weeklyChange, goal });
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
  
  // Get monthly activity data
  app.get("/api/activity/monthly", async (_req: Request, res: Response) => {
    try {
      const now = new Date();
      const startDate = format(new Date(now.getFullYear(), now.getMonth() - 2, 1), "yyyy-MM-dd");
      const endDate = format(now, "yyyy-MM-dd");
      
      const monthlyData = await storage.getMonthlyActivityData(MOCK_USER_ID, startDate, endDate);
      
      res.json(monthlyData);
    } catch (error) {
      console.error("Error fetching monthly activity data:", error);
      res.status(500).json({ message: "Error fetching monthly activity data" });
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
      // Get user tips from database or generate new ones
      let tips = await storage.getTips(MOCK_USER_ID);
      
      if (tips.length === 0) {
        // Generate initial tips
        const initialTips = [
          {
            id: `tip-1-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            category: "mood",
            title: "Practice Gratitude",
            description: "Studies show that writing down three things you're grateful for each day can significantly boost your mood."
          },
          {
            id: `tip-2-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            category: "sleep",
            title: "Create a Sleep Routine",
            description: "Going to bed and waking up at the same time every day helps regulate your body's internal clock."
          },
          {
            id: `tip-3-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            category: "activity",
            title: "Take Walking Breaks",
            description: "Even short 5-minute walks throughout your day can improve energy levels and focus."
          }
        ];
        
        // Save initial tips to database
        for (const tip of initialTips) {
          await storage.insertTip({
            userId: MOCK_USER_ID,
            category: tip.category,
            title: tip.title,
            description: tip.description,
            id: tip.id
          });
        }
        
        tips = initialTips;
      }
      
      res.json({ tips });
    } catch (error) {
      console.error("Error fetching tips:", error);
      res.status(500).json({ message: "Error fetching tips" });
    }
  });
  
  // === Achievements Routes ===
  
  // Get user achievements
  app.get("/api/achievements", async (_req: Request, res: Response) => {
    try {
      const achievements = await storage.getAllAchievements(MOCK_USER_ID);
      res.json(achievements);
    } catch (error) {
      console.error("Error fetching achievements:", error);
      res.status(500).json({ message: "Error fetching achievements" });
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
    // Fetch necessary data
    const journals = await storage.getJournalEntries(userId, 30);
    const now = new Date();
    const startDate = format(subDays(now, 30), "yyyy-MM-dd");
    const endDate = format(now, "yyyy-MM-dd");
    
    const moods = (await storage.getMoods(userId, startDate, endDate)).moods;
    const sleep = (await storage.getSleep(userId, startDate, endDate)).sleep;
    const activity = (await storage.getActivity(userId, startDate, endDate)).activity;
    
    // Extract themes from journals
    const themes = ai.extractJournalThemes(journals);
    
    // Find correlations between data points
    const correlations = ai.findJournalCorrelations(moods, sleep, activity, journals);
    
    // Get existing insights
    const existingInsights = await storage.getJournalInsights(userId);
    
    if (existingInsights.themes.length > 0) {
      // Update existing insights
      await db.update(schema.journalInsights).set({
        themes,
        correlations,
        // @ts-ignore
        lastUpdated: new Date(),
      }).where(eq(schema.journalInsights.userId, userId));
    } else {
      // Create new insights
      await storage.insertJournalInsight({
        userId,
        themes,
        correlations,
        // @ts-ignore
        lastUpdated: new Date(),
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
    // Fetch user data
    const journals = await storage.getJournalEntries(userId, 30);
    const now = new Date();
    const startDate = format(subDays(now, 30), "yyyy-MM-dd");
    const endDate = format(now, "yyyy-MM-dd");
    
    const moods = (await storage.getMoods(userId, startDate, endDate)).moods;
    const sleep = (await storage.getSleep(userId, startDate, endDate)).sleep;
    const activity = (await storage.getActivity(userId, startDate, endDate)).activity;
    
    // Check which achievements have been unlocked
    const achievedIds = ai.checkAchievements(moods, sleep, activity, journals);
    
    if (achievedIds.length > 0) {
      for (const achievementId of achievedIds) {
        await storage.updateUserAchievement(userId, achievementId, {
          achieved: true,
          achievedAt: new Date()
        });
      }
    }
  } catch (error) {
    console.error("Error checking achievements:", error);
  }
}