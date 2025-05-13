/**
 * Tesseract OCR modul
 * 
 * Tento modul implementuje rozpoznávání textu pomocí Tesseract OCR,
 * které je skutečným OCR řešením a skutečně rozpoznává text z obrázků.
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

interface OCRResult {
  success: boolean;
  text: string;
  confidence?: number;
  error?: string;
  execution_time?: number;
}

/**
 * Perform Tesseract OCR on an image
 * 
 * @param imagePath Path to the image file
 * @param language Language code (default: 'eng')
 * @returns Promise with OCR result containing text or error
 */
export async function performTrOCR(imagePath: string, language: string = 'eng'): Promise<OCRResult> {
  console.log(`Provádím Tesseract OCR pro: ${imagePath}`);
  console.log(`Jazyk: ${language}`);
  
  const startTime = Date.now();
  
  try {
    // Check if input image exists
    if (!fs.existsSync(imagePath)) {
      console.error(`Vstupní obrázek nebyl nalezen: ${imagePath}`);
      return {
        success: false,
        text: '',
        error: `Vstupní obrázek nebyl nalezen: ${imagePath}`
      };
    }
    
    // Use appropriate language code
    // Tesseract uses 3-letter ISO codes
    const tessLang = language === 'ces' ? 'ces' : 'eng';
    
    // Spawn tesseract process
    const tesseractProcess = spawn('tesseract', [
      imagePath,
      'stdout',
      '-l', tessLang,
      '--psm', '6',  // Assume a single uniform block of text
      '--oem', '3'   // Default OCR engine mode
    ]);
    
    // Collect stdout data
    let stdoutData = '';
    let stderrData = '';
    
    tesseractProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });
    
    tesseractProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
      console.error(`Tesseract stderr: ${data.toString()}`);
    });
    
    // Return a promise that resolves when the process exits
    return new Promise<OCRResult>((resolve) => {
      // Set a timeout in case process hangs
      const timeout = setTimeout(() => {
        console.error('Tesseract proces - timeout po 30 sekundách');
        tesseractProcess.kill();
        resolve({
          success: false,
          text: '',
          error: 'Timeout (30 sekund) - OCR zpracování trvá příliš dlouho. Zkuste použít zmenšený obrázek.'
        });
      }, 30000);
      
      tesseractProcess.on('close', (code) => {
        clearTimeout(timeout);
        const processingTime = (Date.now() - startTime) / 1000; // v sekundách
        console.log(`Tesseract proces dokončen s kódem ${code} za ${processingTime.toFixed(2)} sekund`);
        
        if (code !== 0) {
          console.error(`Tesseract chyba: ${stderrData}`);
          resolve({ 
            success: false, 
            text: '', 
            error: `Tesseract proces selhal s kódem ${code}: ${stderrData}` 
          });
          return;
        }
        
        // Cleanup text output (remove unnecessary line breaks, etc.)
        const text = stdoutData.trim()
          .replace(/\\r\\n/g, '\n')
          .replace(/\\n/g, '\n')
          .replace(/\n{3,}/g, '\n\n');  // Replace multiple consecutive line breaks with max two
        
        console.log(`Rozpoznávání dokončeno: délka textu=${text.length}`);
        
        resolve({
          success: true,
          text,
          confidence: 0.8,  // Tesseract doesn't easily report confidence this way
          execution_time: processingTime
        });
      });
      
      tesseractProcess.on('error', (error) => {
        clearTimeout(timeout);
        console.error(`Nepodařilo se spustit Tesseract proces: ${error}`);
        resolve({ 
          success: false, 
          text: '', 
          error: `Nepodařilo se spustit Tesseract proces: ${error}` 
        });
      });
    });
  } catch (error) {
    console.error(`Chyba během OCR zpracování: ${error}`);
    return {
      success: false,
      text: '',
      error: `Chyba během OCR zpracování: ${error}`
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