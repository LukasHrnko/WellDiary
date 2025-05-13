/**
 * Hugging Face OCR modul
 * 
 * Tento modul používá Hugging Face API k přístupu k TrOCR modelu
 * (microsoft/trocr-base-handwritten) pro rozpoznávání ručně psaného textu.
 */

import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';
import FormData from 'form-data';

// API endpoint pro Microsoft TrOCR model
// Správná URL pro Hugging Face Inference API
const TROCR_API_URL = 'https://api-inference.huggingface.co/models/microsoft/trocr-base-handwritten';

interface OCRResult {
  success: boolean;
  text: string;
  confidence?: number;
  error?: string;
  execution_time?: number;
}

/**
 * Perform OCR using the Microsoft TrOCR model via Hugging Face API
 * 
 * @param imagePath Path to the image file
 * @param language Language code (default: 'eng', not used in actual API call but kept for interface consistency)
 * @returns Promise with OCR result containing text or error
 */
export async function performTrOCR(imagePath: string, language: string = 'eng'): Promise<OCRResult> {
  console.log(`Provádím TrOCR přes Hugging Face API pro: ${imagePath}`);
  console.log(`Jazyk: ${language} (ignorován pro TrOCR API)`);
  
  const startTime = Date.now();
  
  try {
    // Kontrola API klíče
    const apiKey = process.env.HUGGINGFACE_API_KEY;
    if (!apiKey) {
      throw new Error('HUGGINGFACE_API_KEY není nastaven v prostředí');
    }
    
    // Zkontrolujeme, zda soubor existuje
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Vstupní soubor neexistuje: ${imagePath}`);
    }
    
    // Načtení obrázku
    const imageBuffer = fs.readFileSync(imagePath);
    
    // Odeslání požadavku na Hugging Face API
    const response = await fetch(TROCR_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/octet-stream',
      },
      body: imageBuffer,
      timeout: 30000 // 30 sekund timeout
    });
    
    // Kontrola odpovědi
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Hugging Face API vrátila chybu: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    // Zpracování odpovědi
    const result = await response.json();
    
    if (!result || !result[0] || typeof result[0].generated_text !== 'string') {
      throw new Error(`Neočekávaný formát odpovědi z API: ${JSON.stringify(result)}`);
    }
    
    const recognizedText = result[0].generated_text.trim();
    const executionTime = (Date.now() - startTime) / 1000;
    
    console.log(`TrOCR dokončeno za ${executionTime.toFixed(2)} sekund`);
    console.log(`Rozpoznaný text: ${recognizedText}`);
    
    return {
      success: true,
      text: recognizedText,
      confidence: 0.95, // TrOCR API neposkytuje confidence score
      execution_time: executionTime
    };
  } catch (error) {
    console.error(`Chyba během TrOCR zpracování: ${error}`);
    
    return {
      success: false,
      text: '',
      error: `Chyba během TrOCR zpracování: ${error}`,
      execution_time: (Date.now() - startTime) / 1000
    };
  }
}

/**
 * Save uploaded image to a temporary location
 * 
 * @param buffer Image buffer
 * @param filename Original filename
 * @returns Path to the saved image
 */
export function saveUploadedImage(buffer: Buffer, filename: string): string {
  const tmpDir = path.join('/tmp', 'welldiary-uploads');
  
  // Create temporary directory if it doesn't exist
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  
  // Generate unique filename
  const uniqueFilename = `${Date.now()}-${filename}`;
  const filePath = path.join(tmpDir, uniqueFilename);
  
  // Save file
  fs.writeFileSync(filePath, buffer);
  
  return filePath;
}

/**
 * Clean up temporary image file after processing
 * 
 * @param filePath Path to the image file to delete
 */
export function cleanupImage(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error(`Failed to cleanup image: ${error}`);
  }
}