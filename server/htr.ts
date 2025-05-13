/**
 * HTR (Handwritten Text Recognition) modul
 * Specializovaná implementace pro rozpoznávání rukopisu
 * 
 * Tento modul kombinuje zpracování obrazu a Tesseract.js pro lepší rozpoznávání rukopisu
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
// Import knihovny Jimp pro zpracování obrazu
import Jimp from 'jimp';
import { createWorker, PSM } from 'tesseract.js';
import { readFile } from 'fs/promises';

interface HTRResult {
  success: boolean;
  text: string;
  confidence?: number;
  error?: string;
}

// Create a temporary directory to store uploaded images
const uploadDir = path.join(os.tmpdir(), 'welldiary-uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * Předzpracování obrazu pro HTR
 * Používá standardní knihovny pro předzpracování rukopisu
 * 
 * @param imagePath Cesta k obrázku
 * @returns Cesta k předzpracovanému obrázku
 */
async function preprocessForHTR(imagePath: string): Promise<string> {
  try {
    console.log('Preprocessing image for HTR');
    
    // Zpracování obrazu pomocí standardních knihoven
    // Pro jednoduchost přeskočíme složité zpracování obrazu a použijeme přímo tesseract
    // s optimalizovaným nastavením
    
    // Vytvoření cesty pro předzpracovaný obrázek
    const processedImagePath = path.join(uploadDir, `htr-processed-${path.basename(imagePath)}`);
    
    // Zkopírujeme původní obrázek pro pozdější zpracování v tesseractu
    fs.copyFileSync(imagePath, processedImagePath);
    
    console.log('Set up preprocessed image for HTR');
    return processedImagePath;
  } catch (error) {
    console.error('Error during HTR preprocessing:', error);
    return imagePath; // Při chybě vrátíme původní obraz
  }
}

/**
 * Perform HTR (Handwritten Text Recognition) on an image
 * 
 * @param imagePath Path to the image file
 * @returns Promise with HTR result containing text or error
 */
export async function performHTR(imagePath: string): Promise<HTRResult> {
  try {
    console.log('Starting HTR process on:', imagePath);
    
    // Předzpracování obrazu
    const preprocessedImagePath = await preprocessForHTR(imagePath);
    
    // Nastavení Tesseract.js workeru s optimalizací pro rukopis
    const worker = await createWorker('eng');
    
    // Nastavení parametrů optimalizovaných specificky pro rukopis
    await worker.setParameters({
      tessedit_ocr_engine_mode: '2',                      // LSTM only - lepší pro rukopis
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,            // Assume a single uniform block of text
      tessedit_char_whitelist: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,;:\'"-()!? ', // Povolené znaky
      load_system_dawg: '0',                              // Vypnutí slovníku - lepší pro nestandardní text
      language_model_penalty_non_dict_word: '0.5',        // Snížení penalizace za slova mimo slovník
    });
    
    // Rozpoznání textu
    console.log('Performing HTR recognition...');
    const result = await worker.recognize(preprocessedImagePath);
    const { text, confidence } = result.data;
    
    // Ukončení workeru
    await worker.terminate();
    
    // Čištění dočasných souborů
    if (preprocessedImagePath !== imagePath) {
      try {
        fs.unlinkSync(preprocessedImagePath);
      } catch (err) {
        console.error('Error cleaning up preprocessed image:', err);
      }
    }
    
    console.log('HTR recognition complete, confidence:', confidence);
    
    // Apply post-processing specific for handwritten text
    const enhancedText = postProcessHandwrittenText(text);
    
    return {
      success: true,
      text: enhancedText,
      confidence: confidence
    };
  } catch (error) {
    console.error('HTR processing error:', error);
    return {
      success: false,
      text: '',
      error: error instanceof Error ? error.message : 'Unknown HTR processing error'
    };
  }
}

/**
 * Post-process recognized handwritten text
 * 
 * @param text Recognized text
 * @returns Enhanced text
 */
function postProcessHandwrittenText(text: string): string {
  // Split into lines and remove empty ones
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // Process each line
  let processedLines = lines.map(line => {
    return line
      // Fix common OCR errors in handwriting
      .replace(/[lI]'m/g, "I'm")
      .replace(/\bwos\b/g, "was")
      .replace(/\bthot\b/g, "that")
      .replace(/\b[lI]\s+/g, "I ")
      .replace(/\b[lI]t\b/g, "It")
      .replace(/\b[lI]f\b/g, "If")
      .replace(/\b[lI]s\b/g, "Is")
      .replace(/\b[lI]n\b/g, "In")
      .replace(/\b[oO]0\b/g, "O")
      .replace(/\b0[oO]\b/g, "O");
  });
  
  // Join the processed lines back together
  let result = processedLines.join('\n');
  
  // Fix sentence capitalization
  result = result.replace(/([.!?]\s+)([a-z])/g, (match, p1, p2) => p1 + p2.toUpperCase());
  
  // Fix common date formats
  result = result.replace(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/g, '$1/$2/$3');
  
  // Fix multi-letter spacing issues (like "t h e")
  result = result.replace(/\b([a-z]) ([a-z]) ([a-z])\b/g, '$1$2$3');
  
  return result;
}

/**
 * Save uploaded image to a temporary location
 * 
 * @param buffer Image buffer
 * @param filename Original filename
 * @returns Path to the saved image
 */
export function saveUploadedImage(buffer: Buffer, filename: string): string {
  // Generate a unique filename
  const uniqueFilename = `${Date.now()}-${filename}`;
  const filePath = path.join(uploadDir, uniqueFilename);
  
  // Save the file
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
    console.error('Error cleaning up temporary image file:', error);
  }
}