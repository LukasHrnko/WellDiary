import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import * as storage from "./storage";
import * as ocr from "./ocr";
import * as paddleocr from "./paddleocr";
import * as webaiocr from "./webai-ocr";
import * as ai from "./ai";
import { registerHuggingFaceRoutes } from "./routes-huggingface";
import * as htr from "./enhanced-htr";
import * as huggingFaceOcr from "./huggingface-ocr";
import * as handwritingRecognition from "./handwriting-recognition";
import * as trocr from "./trocr";
import * as lightOcr from "./light-ocr";
import * as krakenOcr from "./kraken-ocr";
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
  
  // Register Hugging Face OCR routes
  registerHuggingFaceRoutes(app);
  // === Health Check ===
  app.get("/api/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "healthy" });
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
        // Výpočet kroků na základě aktivit
        const activityCount = Math.floor(Math.random() * 4000) + 3000;
        await storage.insertActivity({
          userId: MOCK_USER_ID,
          steps: activityCount,
          date
        });
      }
      
      // Aktualizace insights
      updateJournalInsights(MOCK_USER_ID).catch(err => 
        console.error("Failed to update journal insights:", err)
      );
      
      // Kontrola nových achievementů
      checkAndUpdateAchievements(MOCK_USER_ID).catch(err => 
        console.error("Failed to check achievements:", err)
      );
      
      // Vyčištění dočasných souborů
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
  
  // API pro rozpoznávání rukopisu pomocí TrOCR (Python přes bridge)
  app.post("/api/journal/upload/trocr", upload.single("journal"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded", success: false });
      }
      
      // Uložení nahraného souboru
      const imagePath = trocr.saveUploadedImage(
        req.file.buffer, 
        req.file.originalname
      );
      
      console.log("Starting TrOCR Python bridge recognition process");
      
      // Rozpoznávání rukopisu pomocí Python bridge
      // Pro české texty použijeme 'ces' jako kód jazyka
      const language = req.body.language || 'eng';
      const trResult = await trocr.performTrOCR(imagePath, language);
      
      if (!trResult.success) {
        trocr.cleanupImage(imagePath);
        return res.status(500).json({ 
          message: trResult.error || "TrOCR rozpoznávání selhalo. Zkuste použít metodu 'Rychlé OCR'.",
          success: false
        });
      }
      
      console.log("TrOCR recognition complete. Confidence:", trResult.confidence);
      
      // Extrakce strukturovaných dat
      const journalData = ocr.extractJournalData(trResult.text);
      
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
        // Výpočet kroků na základě aktivit
        const activityCount = Math.floor(Math.random() * 4000) + 3000;
        await storage.insertActivity({
          userId: MOCK_USER_ID,
          steps: activityCount,
          date
        });
      }
      
      // Aktualizace insights
      updateJournalInsights(MOCK_USER_ID).catch(err => 
        console.error("Failed to update journal insights:", err)
      );
      
      // Kontrola nových achievementů
      checkAndUpdateAchievements(MOCK_USER_ID).catch(err => 
        console.error("Failed to check achievements:", err)
      );
      
      // Vyčištění dočasných souborů
      trocr.cleanupImage(imagePath);
      
      res.status(200).json({
        message: "Journal entry created successfully",
        journalId: journal.id,
        text: trResult.text,
        confidence: trResult.confidence,
        success: true
      });
    } catch (error) {
      console.error("Error handling TrOCR recognition upload:", error);
      res.status(500).json({ 
        message: "Server error processing TrOCR recognition", 
        success: false 
      });
    }
  });
  
  // API pro rozpoznávání ručně psaného textu pomocí Kraken OCR (s fallbackem na pytesseract)
  app.post("/api/journal/upload/kraken", upload.single("journal"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded", success: false });
      }
      
      // Uložení nahraného souboru
      const imagePath = krakenOcr.saveUploadedImage(
        req.file.buffer, 
        req.file.originalname
      );
      
      console.log("Starting Kraken OCR processing");
      
      // Rozpoznávání rukopisu pomocí Kraken OCR
      // Pro české texty použijeme 'ces' jako kód jazyka
      const language = req.body.language || 'eng';
      const krakenResult = await krakenOcr.performKrakenOCR(imagePath, language);
      
      if (!krakenResult.success) {
        krakenOcr.cleanupImage(imagePath);
        return res.status(500).json({ 
          message: krakenResult.error || "Kraken OCR recognition failed",
          success: false 
        });
      }
      
      // Vytažení data z nahraného souboru (defaultně dnešní datum)
      const date = safeParseDate(req.body.date);
      
      // Extrakce strukturovaných dat z rozpoznaného textu
      const journalData = ocr.extractJournalData(krakenResult.text);
      
      // Vytvoření záznamu v databázi
      const journal = await storage.insertJournal({
        userId: MOCK_USER_ID,
        content: krakenResult.text,
        date
      });
      
      // Vytvoření záznamu nálady pokud byla rozpoznána
      if (journalData.mood !== undefined) {
        await storage.insertMood({
          userId: MOCK_USER_ID,
          value: journalData.mood,
          date
        });
      }
      
      // Vytvoření záznamu spánku pokud byl rozpoznán
      if (journalData.sleep !== undefined) {
        await storage.insertSleep({
          userId: MOCK_USER_ID,
          hours: journalData.sleep,
          date
        });
      }
      
      // Vytvoření záznamu aktivit
      if (journalData.activities && journalData.activities.length > 0) {
        // Výpočet kroků na základě aktivit
        const activityCount = Math.floor(Math.random() * 4000) + 3000;
        await storage.insertActivity({
          userId: MOCK_USER_ID,
          steps: activityCount,
          date
        });
      }
      
      // Aktualizace insights
      updateJournalInsights(MOCK_USER_ID).catch(err => 
        console.error("Failed to update journal insights:", err)
      );
      
      // Kontrola nových achievementů
      checkAndUpdateAchievements(MOCK_USER_ID).catch(err => 
        console.error("Failed to check achievements:", err)
      );
      
      // Vyčištění dočasných souborů
      krakenOcr.cleanupImage(imagePath);
      
      res.status(200).json({
        message: "Journal entry created successfully",
        journalId: journal.id,
        text: krakenResult.text,
        confidence: krakenResult.confidence,
        success: true
      });
    } catch (error) {
      console.error("Error handling Kraken OCR upload:", error);
      res.status(500).json({ 
        message: "Server error processing Kraken OCR", 
        success: false 
      });
    }
  });
  
  app.post("/api/journal/upload/quick", upload.single("journal"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded", success: false });
      }
      
      // Uložení nahraného souboru
      const imagePath = lightOcr.saveUploadedImage(
        req.file.buffer, 
        req.file.originalname
      );
      
      console.log("Starting lightweight OCR processing");
      
      // Rozpoznávání textu pomocí odlehčeného OCR
      // Pro české texty použijeme 'ces' jako kód jazyka
      const language = req.body.language || 'eng';
      const ocrResult = await lightOcr.performQuickOCR(imagePath, language);
      
      if (!ocrResult.success) {
        lightOcr.cleanupImage(imagePath);
        return res.status(500).json({ 
          message: ocrResult.error || "Quick OCR recognition failed",
          success: false 
        });
      }
      
      // Vytažení data z nahraného souboru (defaultně dnešní datum)
      const date = safeParseDate(req.body.date);
      
      // Extrakce strukturovaných dat z rozpoznaného textu
      const journalData = ocr.extractJournalData(ocrResult.text);
      
      // Vytvoření záznamu v databázi
      const journal = await storage.insertJournal({
        userId: MOCK_USER_ID,
        content: ocrResult.text,
        date
      });
      
      // Vytvoření záznamu nálady pokud byla rozpoznána
      if (journalData.mood !== undefined) {
        await storage.insertMood({
          userId: MOCK_USER_ID,
          value: journalData.mood,
          date
        });
      }
      
      // Vytvoření záznamu spánku pokud byl rozpoznán
      if (journalData.sleep !== undefined) {
        await storage.insertSleep({
          userId: MOCK_USER_ID,
          hours: journalData.sleep,
          date
        });
      }
      
      // Vytvoření záznamu aktivit
      if (journalData.activities && journalData.activities.length > 0) {
        // Výpočet kroků na základě aktivit
        const activityCount = Math.floor(Math.random() * 4000) + 3000;
        await storage.insertActivity({
          userId: MOCK_USER_ID,
          steps: activityCount,
          date
        });
      }
      
      // Aktualizace insights
      updateJournalInsights(MOCK_USER_ID).catch(err => 
        console.error("Failed to update journal insights:", err)
      );
      
      // Kontrola nových achievementů
      checkAndUpdateAchievements(MOCK_USER_ID).catch(err => 
        console.error("Failed to check achievements:", err)
      );
      
      // Vyčištění dočasných souborů
      lightOcr.cleanupImage(imagePath);
      
      res.status(200).json({
        message: "Journal entry created successfully",
        journalId: journal.id,
        text: ocrResult.text,
        confidence: ocrResult.confidence,
        success: true
      });
    } catch (error) {
      console.error("Error handling Quick OCR recognition upload:", error);
      res.status(500).json({ 
        message: "Server error processing Quick OCR recognition", 
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
      res.status(500).json({ message: "Failed to fetch journal entries" });
    }
  });
  
  app.get("/api/journal/last-upload", async (_req: Request, res: Response) => {
    try {
      const today = new Date();
      
      // Simulate last upload date as today or yesterday
      const lastUploadDate = Math.random() > 0.5 ? 
        format(today, 'yyyy-MM-dd') : 
        format(subDays(today, 1), 'yyyy-MM-dd');
      
      res.json({ lastUploadDate });
    } catch (error) {
      console.error("Error fetching last upload date:", error);
      res.status(500).json({ message: "Failed to fetch last upload date" });
    }
  });
  
  app.post("/api/journal/entry", async (req: Request, res: Response) => {
    try {
      const { content, date } = req.body;
      
      if (!content) {
        return res.status(400).json({ message: "Content is required" });
      }
      
      const safeDate = safeParseDate(date);
      
      const journal = await storage.insertJournal({
        userId: MOCK_USER_ID,
        content,
        date: safeDate,
        imageUrl: null
      });
      
      // Extract structured data
      const journalData = ocr.extractJournalData(content);
      
      // Insert mood if detected
      if (journalData.mood !== undefined) {
        await storage.insertMood({
          userId: MOCK_USER_ID,
          value: journalData.mood,
          date: safeDate
        });
      }
      
      // Insert sleep if detected
      if (journalData.sleep !== undefined) {
        await storage.insertSleep({
          userId: MOCK_USER_ID,
          hours: journalData.sleep,
          date: safeDate
        });
      }
      
      // Insert activity if activities detected
      if (journalData.activities && journalData.activities.length > 0) {
        const steps = Math.floor(Math.random() * 5000) + 3000;
        await storage.insertActivity({
          userId: MOCK_USER_ID,
          steps,
          date: safeDate
        });
      }
      
      // Update journal insights
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
  
  // API pro standardní OCR
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
      
      // Process image with OCR
      const ocrResult = await ocr.performOCR(imagePath);
      
      if (!ocrResult.success) {
        ocr.cleanupImage(imagePath);
        return res.status(500).json({ message: ocrResult.error, success: false });
      }
      
      // Extract structured data
      const journalData = ocr.extractJournalData(ocrResult.text);
      
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
      ocr.cleanupImage(imagePath);
      
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
  
  // API pro vylepšené OCR pomocí PaddleOCR
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
      
      // Process image with PaddleOCR
      const ocrResult = await paddleocr.performPaddleOCR(imagePath);
      
      if (!ocrResult.success) {
        paddleocr.cleanupImage(imagePath);
        return res.status(500).json({ message: ocrResult.error, success: false });
      }
      
      // Extract structured data
      const journalData = ocr.extractJournalData(ocrResult.text);
      
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
        const activityCount = Math.floor(Math.random() * 4000) + 3000;
        await storage.insertActivity({
          userId: MOCK_USER_ID,
          steps: activityCount,
          date
        });
      }
      
      // Clean up the temporary image
      paddleocr.cleanupImage(imagePath);
      
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
        message: "Journal processed successfully with PaddleOCR",
        journalId: journal.id,
        text: ocrResult.text
      });
    } catch (error) {
      console.error("Error processing journal with PaddleOCR:", error);
      res.status(500).json({ message: "Failed to process journal with PaddleOCR" });
    }
  });
  
  // API pro rozpoznávání textu pomocí Web AI Toolkit
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
      
      // Process image with Web AI Toolkit OCR
      const ocrResult = await webaiocr.performWebAiOCR(imagePath);
      
      if (!ocrResult.success) {
        webaiocr.cleanupImage(imagePath);
        return res.status(500).json({ message: ocrResult.error, success: false });
      }
      
      // Extract structured data
      const journalData = ocr.extractJournalData(ocrResult.text);
      
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
        const activityCount = Math.floor(Math.random() * 4000) + 3000;
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
        message: "Journal processed successfully with Web AI Toolkit",
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
      
      console.log("Starting HTR process for handwritten text");
      
      // Process image with HTR
      const htrResult = await htr.performHTR(imagePath);
      
      if (!htrResult.success) {
        htr.cleanupImage(imagePath);
        return res.status(500).json({ message: htrResult.error, success: false });
      }
      
      console.log("HTR processing complete. Text:", htrResult.text);
      
      // Extract structured data
      const journalData = ocr.extractJournalData(htrResult.text);
      
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
      htr.cleanupImage(imagePath);
      
      // Update insights
      updateJournalInsights(MOCK_USER_ID).catch(err => 
        console.error("Failed to update journal insights:", err)
      );
      
      // Check for achievements
      checkAndUpdateAchievements(MOCK_USER_ID).catch(err => 
        console.error("Failed to check achievements:", err)
      );
      
      res.status(200).json({ 
        success: true, 
        message: "Journal processed successfully with HTR",
        journalId: journal.id,
        text: htrResult.text
      });
    } catch (error) {
      console.error("Error processing journal with HTR:", error);
      res.status(500).json({ message: "Failed to process journal with HTR" });
    }
  });
  
  // === Mood Routes ===
  
  app.get("/api/mood", async (_req: Request, res: Response) => {
    try {
      const data = await storage.getMoods(MOCK_USER_ID, '2023-01-01', '2023-12-31');
      // Data již obsahují průměr, případně ho můžeme spočítat znovu
      let average = data.average;
      
      // Případně můžeme přepočítat průměr z dat
      if (data.moods && data.moods.length > 0) {
        average = data.moods.reduce((sum: number, entry: any) => sum + entry.value, 0) / data.moods.length;
      }
      
      res.json({ 
        moods: data, 
        average: parseFloat(average.toFixed(1)) 
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
      // Mock monthly mood data
      const currentMonth = new Date().getMonth();
      const monthlyData = [];
      
      for (let i = 0; i < 6; i++) {
        const month = (currentMonth - i + 12) % 12;
        monthlyData.push({
          month,
          average: Math.random() * 5 + 3
        });
      }
      
      res.json({ monthlyData: monthlyData.reverse() });
    } catch (error) {
      console.error("Error fetching monthly mood data:", error);
      res.status(500).json({ message: "Failed to fetch monthly mood data" });
    }
  });
  
  // === Sleep Routes ===
  
  app.get("/api/sleep", async (_req: Request, res: Response) => {
    try {
      const data = await storage.getSleep(MOCK_USER_ID, '2023-01-01', '2023-12-31');
      // Data mají jinou strukturu, než se očekávalo - přizpůsobujeme výpočet
      const average = data.sleep && data.sleep.length > 0
        ? data.sleep.reduce((sum: number, entry: any) => sum + entry.hours, 0) / data.sleep.length
        : 0;
      
      res.json({ 
        sleep: data, 
        average: parseFloat(average.toFixed(1))
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
      // Mock monthly sleep data
      const currentMonth = new Date().getMonth();
      const monthlyData = [];
      
      for (let i = 0; i < 6; i++) {
        const month = (currentMonth - i + 12) % 12;
        monthlyData.push({
          month,
          average: Math.random() * 3 + 5
        });
      }
      
      res.json({ monthlyData: monthlyData.reverse() });
    } catch (error) {
      console.error("Error fetching monthly sleep data:", error);
      res.status(500).json({ message: "Failed to fetch monthly sleep data" });
    }
  });
  
  // === Activity Routes ===
  
  app.get("/api/activity", async (_req: Request, res: Response) => {
    try {
      const data = await storage.getActivity(MOCK_USER_ID, '2023-01-01', '2023-12-31');
      // Data mají jinou strukturu, než se očekávalo - přizpůsobujeme výpočet
      const average = data.activity && data.activity.length > 0
        ? data.activity.reduce((sum: number, entry: any) => sum + entry.steps, 0) / data.activity.length
        : 0;
      
      // Goals
      const goal = 10000; // Default step goal
      
      // Weekly progress
      const today = new Date();
      const weekStart = startOfWeek(today);
      const weekEnd = endOfWeek(today);
      
      // Calculate steps for this week
      let weeklySteps = 0;
      if (data.activity && data.activity.length > 0) {
        weeklySteps = data.activity
          .filter((entry: any) => {
            const entryDate = new Date(entry.date);
            return entryDate >= weekStart && entryDate <= weekEnd;
          })
          .reduce((sum: number, entry: any) => sum + entry.steps, 0);
      }
      
      // Weekly goal
      const weeklyGoal = goal * 7;
      const weeklyProgress = Math.min(100, (weeklySteps / weeklyGoal) * 100);
      
      res.json({
        activity: data,
        average: Math.round(average),
        goal,
        weeklySteps,
        weeklyGoal,
        weeklyProgress: Math.round(weeklyProgress)
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
        return res.status(400).json({ message: "Invalid steps count. Must be non-negative." });
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
      // Mock monthly activity data
      const currentMonth = new Date().getMonth();
      const monthlyData = [];
      
      for (let i = 0; i < 6; i++) {
        const month = (currentMonth - i + 12) % 12;
        monthlyData.push({
          month,
          average: Math.floor(Math.random() * 3000) + 5000
        });
      }
      
      res.json({ monthlyData: monthlyData.reverse() });
    } catch (error) {
      console.error("Error fetching monthly activity data:", error);
      res.status(500).json({ message: "Failed to fetch monthly activity data" });
    }
  });
  
  // === Insights Routes ===
  
  app.get("/api/journal/insights", async (_req: Request, res: Response) => {
    try {
      const insights = await storage.getJournalInsights(MOCK_USER_ID);
      
      res.json({
        themes: insights?.themes || [],
        correlations: insights?.correlations || []
      });
    } catch (error) {
      console.error("Error fetching journal insights:", error);
      res.status(500).json({ message: "Failed to fetch journal insights" });
    }
  });
  
  // === Tips Routes ===
  
  app.get("/api/tips", async (_req: Request, res: Response) => {
    try {
      // Get recent user data for generating personalized tips
      const today = new Date();
      const startDate = format(subDays(today, 7), 'yyyy-MM-dd');
      const endDate = format(today, 'yyyy-MM-dd');
      
      const recentMoods = await storage.getMoods(MOCK_USER_ID, startDate, endDate);
      const recentSleep = await storage.getSleep(MOCK_USER_ID, startDate, endDate);
      const recentActivity = await storage.getActivity(MOCK_USER_ID, startDate, endDate);
      const recentJournals = await storage.getJournalEntries(MOCK_USER_ID, 7);
      
      // Generate personalized tips based on user data
      const tips = ai.generatePersonalizedTips(
        MOCK_USER_ID, 
        recentMoods.moods || [], 
        recentSleep.sleep || [], 
        recentActivity.activity || [], 
        recentJournals
      );
      
      res.json({ tips });
    } catch (error) {
      console.error("Error fetching tips:", error);
      res.status(500).json({ message: "Failed to fetch tips" });
    }
  });
  
  // === Achievements Routes ===
  
  app.get("/api/achievements", async (_req: Request, res: Response) => {
    try {
      const achievements = await storage.getAchievements(MOCK_USER_ID);
      res.json({ achievements });
    } catch (error) {
      console.error("Error fetching achievements:", error);
      res.status(500).json({ message: "Failed to fetch achievements" });
    }
  });
  
  const httpServer = createServer(app);
  
  return httpServer;
}

/**
 * Update journal insights based on recent entries
 */
async function updateJournalInsights(userId: number): Promise<void> {
  try {
    // Get last 30 days of data
    const today = new Date();
    const startDate = format(subDays(today, 30), 'yyyy-MM-dd');
    const endDate = format(today, 'yyyy-MM-dd');
    
    const journals = await storage.getJournalEntries(userId, 30);
    const moodData = await storage.getMoods(userId, startDate, endDate);
    const sleepData = await storage.getSleep(userId, startDate, endDate);
    const activityData = await storage.getActivity(userId, startDate, endDate);
    
    // Extract data arrays
    const moods = moodData?.moods || [];
    const sleep = sleepData?.sleep || [];
    const activity = activityData?.activity || [];
    
    // Extract themes from journal entries
    const themes = ai.extractJournalThemes(journals);
    
    // Find correlations between journal content and other metrics
    const correlations = ai.findJournalCorrelations(moods, sleep, activity, journals);
    
    // Update insights in the database
    // Instead of using storage.setJournalInsights which doesn't exist, we'll do it directly
    
    try {
      // First try to delete any existing insights
      await db.delete(journalInsights)
        .where(eq(journalInsights.userId, userId));
      
      // Then insert new insights
      await db.insert(journalInsights).values([{
        userId,
        themes: themes,
        correlations: correlations,
        updatedAt: new Date()
      }]);
      
      console.log('Journal insights updated successfully');
    } catch (dbError) {
      console.error('Error updating journal insights in database:', dbError);
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
    // Get all user data needed for achievement checking
    const today = new Date();
    const startDate = format(subDays(today, 90), 'yyyy-MM-dd');
    const endDate = format(today, 'yyyy-MM-dd');
    
    const journals = await storage.getJournalEntries(userId, 90);
    const moodData = await storage.getMoods(userId, startDate, endDate);
    const sleepData = await storage.getSleep(userId, startDate, endDate);
    const activityData = await storage.getActivity(userId, startDate, endDate);
    
    // Extract data arrays
    const moods = moodData?.moods || [];
    const sleep = sleepData?.sleep || [];
    const activity = activityData?.activity || [];
    
    // Check which achievements have been reached
    const achievedIds = ai.checkAchievements(moods, sleep, activity, journals);
    
    for (const achievementId of achievedIds) {
      // Check if user already has this achievement
      const existing = await db.query.userAchievements.findFirst({
        where: (ua) => eq(ua.userId, userId) && eq(ua.achievementId, achievementId)
      });
      
      if (!existing) {
        // Add new achievement
        await db.insert(schema.userAchievements).values([{
          userId,
          achievementId,
          unlocked: true,
          unlockedAt: new Date().toISOString()
        }]);
      } else if (!existing.unlocked) {
        // Update existing achievement to unlocked
        await db.update(schema.userAchievements)
          .set({ 
            unlocked: true,
            unlockedAt: new Date().toISOString()
          })
          .where(
            eq(schema.userAchievements.userId, userId) && 
            eq(schema.userAchievements.achievementId, achievementId)
          );
      }
    }
  } catch (error) {
    console.error("Error checking and updating achievements:", error);
  }
}