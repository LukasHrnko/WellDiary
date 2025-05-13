// Přidání endpointu pro Hugging Face OCR
import type { Express, Request, Response } from "express";
import * as storage from "./storage";
import * as ocr from "./ocr";
import * as huggingFaceOcr from "./huggingface-ocr";
import * as ai from "./ai";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";
import { db } from "@db";
import multer from "multer";
import { format } from "date-fns";

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Mock user ID for demonstration (in a real app, this would come from auth)
const MOCK_USER_ID = 1;

/**
 * Bezpečné parsování datumu
 */
function safeParseDate(dateStr: string | undefined): string {
  if (!dateStr) {
    return format(new Date(), 'yyyy-MM-dd');
  }
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return format(new Date(), 'yyyy-MM-dd');
    }
    return format(date, 'yyyy-MM-dd');
  } catch (error) {
    return format(new Date(), 'yyyy-MM-dd');
  }
}

/**
 * Aktualizuje insights uživatele na základě jeho deníkových záznamů
 */
async function updateJournalInsights(userId: number): Promise<void> {
  try {
    const journals = await storage.getJournalEntries(userId);
    if (!journals || journals.length === 0) return;
    
    // Extract themes from journal entries
    const themes = ai.extractJournalThemes(journals);
    
    // Get recent data for correlations
    const recentMoods = await storage.getMoods(userId);
    const recentSleep = await storage.getSleep(userId);
    const recentActivity = await storage.getActivity(userId);
    
    // Find correlations between journaling and other metrics
    const correlations = ai.findJournalCorrelations(
      recentMoods,
      recentSleep,
      recentActivity,
      journals
    );
    
    // Update the database with new insights
    const journalInsight = {
      userId,
      lastUpdated: new Date(),
      themes,
      correlations
    };
    
    // Check if insights already exist
    const existingInsights = await storage.getJournalInsights(userId);
    if (existingInsights) {
      // Update existing insights
      await db.update(schema.journalInsights)
        .set(journalInsight)
        .where(eq(schema.journalInsights.userId, userId));
    } else {
      // Insert new insights
      await db.insert(schema.journalInsights).values(journalInsight);
    }
    
    console.log("Journal insights updated successfully");
  } catch (error) {
    console.error("Failed to update journal insights:", error);
  }
}

/**
 * Kontroluje, zda uživatel dosáhl nových achievementů
 */
async function checkAndUpdateAchievements(userId: number): Promise<void> {
  try {
    const journals = await storage.getJournalEntries(userId);
    const moods = await storage.getMoods(userId);
    const sleep = await storage.getSleep(userId);
    const activity = await storage.getActivity(userId);
    
    // Check for new achievements
    const newAchievements = ai.checkAchievements(moods, sleep, activity, journals);
    if (newAchievements.length === 0) return;
    
    // Update user achievements in database
    for (const achievementId of newAchievements) {
      const existingAchievement = await db.select()
        .from(schema.userAchievements)
        .where(eq(schema.userAchievements.userId, userId))
        .where(eq(schema.userAchievements.achievementId, achievementId))
        .limit(1);
      
      if (existingAchievement.length === 0) {
        await db.insert(schema.userAchievements).values({
          userId,
          achievementId,
          unlockedAt: new Date()
        });
      }
    }
    
    console.log(`User ${userId} earned ${newAchievements.length} new achievements`);
  } catch (error) {
    console.error("Failed to check and update achievements:", error);
  }
}

/**
 * Registruje endpointy pro Hugging Face OCR
 */
export function registerHuggingFaceRoutes(app: Express): void {
  // Process handwritten journal using Hugging Face API
  app.post("/api/journal/upload/huggingface", upload.single("journal"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      // Save uploaded image
      const imagePath = huggingFaceOcr.saveUploadedImage(
        req.file.buffer, 
        req.file.originalname
      );
      
      console.log("Starting Hugging Face OCR processing for handwritten text");
      
      // Process image with Hugging Face OCR
      const ocrResult = await huggingFaceOcr.performHuggingFaceOCR(imagePath);
      
      if (!ocrResult.success) {
        huggingFaceOcr.cleanupImage(imagePath);
        return res.status(500).json({ 
          message: ocrResult.error, 
          success: false 
        });
      }
      
      console.log("Hugging Face OCR processing complete. Confidence:", ocrResult.confidence);
      
      // Extract structured data
      const journalData = ocr.extractJournalData(ocrResult.text);
      
      // Extract date or use today's date
      const date = safeParseDate(journalData.date);
      
      // Vytvoření záznamu v deníku
      const journal = await storage.insertJournal({
        userId: MOCK_USER_ID,
        content: ocrResult.text,
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
      huggingFaceOcr.cleanupImage(imagePath);
      
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
        message: "Handwritten journal processed successfully with Hugging Face OCR",
        journalId: journal.id,
        text: ocrResult.text,
        confidence: ocrResult.confidence,
        extractedData: {
          date: journalData.date,
          mood: journalData.mood,
          sleep: journalData.sleep,
          activities: journalData.activities
        }
      });
    } catch (error) {
      console.error("Hugging Face OCR processing error:", error);
      res.status(500).json({ 
        message: "Failed to process handwritten journal with Hugging Face OCR",
        success: false
      });
    }
  });
}