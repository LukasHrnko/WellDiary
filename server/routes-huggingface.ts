import { Express, Request, Response } from 'express';
import multer from 'multer';
import * as ocr from './huggingface-ocr';
import * as storage from './storage';
import { db } from "@db";
import { journals } from "@shared/schema";
import { eq } from "drizzle-orm";

// Konstanty
const MOCK_USER_ID = 1; // Použito, když uživatel není přihlášen

// Multer nastavení pro upload souborů
const upload = multer({ storage: multer.memoryStorage() });

/**
 * Zaregistruje endpointy pro zpracování deníkových záznamů s využitím Hugging Face API
 * 
 * @param app Express aplikace
 */
export function registerHuggingFaceRoutes(app: Express): void {
  
  // Endpoint pro nahrání a zpracování deníkového záznamu pomocí Hugging Face OCR
  app.post('/api/journal/upload/huggingface', upload.single('journal'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          message: 'No image uploaded' 
        });
      }
      
      // Získání skutečného ID uživatele z relace nebo použití mock ID
      const userId = req.user?.id || MOCK_USER_ID;
      
      // Vytvoření časového razítka pro záznam (dnes)
      const date = new Date().toISOString().split('T')[0];
      
      // Uložení nahraného obrázku do dočasného souboru
      const imagePath = ocr.saveUploadedImage(req.file.buffer, req.file.originalname);
      
      // Provedení OCR s využitím Hugging Face API
      console.log('Starting Hugging Face TrOCR processing');
      const ocrResult = await ocr.performHuggingFaceOCR(imagePath);
      
      if (!ocrResult.success) {
        ocr.cleanupImage(imagePath);
        return res.status(500).json({ 
          success: false, 
          message: ocrResult.error || 'OCR processing failed' 
        });
      }
      
      // Uložení zpracovaného textu do databáze
      const journalEntries = await storage.insertJournal({
        userId,
        content: ocrResult.text,
        date,
        imageUrl: null
      });
      
      // Vyčištění dočasného souboru
      ocr.cleanupImage(imagePath);
      
      res.status(200).json({
        success: true,
        message: 'Journal processed with Hugging Face TrOCR',
        journalId: journalEntries.id,
        text: ocrResult.text,
        confidence: ocrResult.confidence
      });
    } catch (error) {
      console.error('Error processing journal with Hugging Face OCR:', error);
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  });
}