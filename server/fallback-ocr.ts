/**
 * Fallback OCR modul
 * 
 * Tento modul implementuje náhradní řešení OCR pro případ,
 * že není možné používat TrOCR z Hugging Face API.
 * 
 * Používá jednoduché rozpoznávání textu, které funguje lokálně.
 */

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface OCRResult {
  success: boolean;
  text: string;
  confidence?: number;
  error?: string;
  execution_time?: number;
}

/**
 * Rozpozná text z obrázku pomocí externích nástrojů
 * 
 * @param imagePath Cesta k obrázku
 * @param language Kód jazyka (výchozí: 'eng')
 * @returns Promise s výsledkem OCR obsahujícím text nebo chybu
 */
export async function performTrOCR(imagePath: string, language: string = 'eng'): Promise<OCRResult> {
  console.log(`Provádím Tesseract OCR pro: ${imagePath}`);
  console.log(`Jazyk: ${language}`);
  
  const startTime = Date.now();
  
  try {
    // Použijeme Tesseract OCR nástroj, který je nainstalován v systému
    const cmd = `tesseract "${imagePath}" stdout -l ${language}`;
    
    const { stdout, stderr } = await execAsync(cmd);
    
    const executionTime = (Date.now() - startTime) / 1000;
    console.log(`Tesseract proces dokončen s kódem 0 za ${executionTime.toFixed(2)} sekund`);
    
    if (stderr && stderr.length > 0) {
      console.error(`Tesseract stderr: ${stderr}`);
    }
    
    let text = stdout.trim();
    console.log(`Rozpoznávání dokončeno: délka textu=${text.length}`);
    
    return {
      success: true,
      text,
      confidence: 0.8, // Tesseract neposkytuje confidence score při použití příkazové řádky
      execution_time: executionTime
    };
  } catch (error) {
    console.error(`Chyba během OCR zpracování: ${error}`);
    
    return {
      success: false,
      text: '',
      error: `Chyba během OCR zpracování: ${error}`,
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