/**
 * Kraken OCR module
 * 
 * Tento modul implementuje integraci s Kraken OCR API serverem (Python)
 * specializovaným na rozpoznávání ručně psaného textu. V případě, že Kraken
 * není k dispozici, automaticky se použije pytesseract jako záloha.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';
import FormData from 'form-data';
import fetch from 'node-fetch';

interface OCRResult {
  success: boolean;
  text: string;
  confidence?: number;
  error?: string;
}

/**
 * Spustí Python Flask server pro Kraken OCR API
 * 
 * @returns Promise, který se resolve, když je server připraven
 */
async function startKrakenServer(): Promise<boolean> {
  try {
    const pythonScriptPath = path.join(process.cwd(), 'server', 'kraken_api.py');
    
    // Zkontrolovat, jestli Python skript existuje
    if (!fs.existsSync(pythonScriptPath)) {
      console.error(`Python script not found at: ${pythonScriptPath}`);
      return false;
    }
    
    // Nastavit práva pro spuštění
    await fs.promises.chmod(pythonScriptPath, 0o755);
    
    // Spustit Python server na pozadí
    const port = 5001; // Použijeme jiný port než hlavní aplikace
    const pythonProcess = spawn('python3', [
      pythonScriptPath
    ], {
      detached: true, // Server běží nezávisle na NodeJS procesu
      stdio: 'inherit', // Výstup bude přesměrován do hlavní konzole
      env: { 
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        FLASK_PORT: port.toString()
      }
    });
    
    // Odpojíme proces, aby běžel samostatně
    pythonProcess.unref();
    
    console.log(`Started Kraken OCR API server on port ${port}`);
    
    // Počkáme chvíli, aby se server stihl nastartovat
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return true;
  } catch (error) {
    console.error(`Failed to start Kraken OCR API server: ${error}`);
    return false;
  }
}

// Uložíme stav serveru jako singleton
let serverStarted = false;

/**
 * Perform handwriting recognition using our custom Handwritten Text Recognition API
 * 
 * @param imagePath Path to the image file
 * @param language Language code (default: 'eng')
 * @returns Promise with OCR result containing text or error
 */
export async function performKrakenOCR(imagePath: string, language: string = 'eng'): Promise<OCRResult> {
  console.log('Starting Handwritten Text Recognition processing');
  console.log(`Processing image: ${imagePath}`);
  console.log(`Language: ${language}`);

  try {
    // Zajistit, že server běží
    if (!serverStarted) {
      serverStarted = await startKrakenServer();
      
      if (!serverStarted) {
        return {
          success: false,
          text: '',
          error: 'Failed to start Handwritten Text Recognition API server'
        };
      }
    }
    
    // Zkontrolovat, zda vstupní obrázek existuje
    if (!fs.existsSync(imagePath)) {
      console.error(`Input image not found at: ${imagePath}`);
      return {
        success: false,
        text: '',
        error: `Input image not found at: ${imagePath}`
      };
    }
    
    // Připravit data pro odeslání
    const form = new FormData();
    form.append('image', fs.createReadStream(imagePath));
    form.append('language', language);
    
    // Nastavit timeout pro požadavek - delší pro hloubkovou analýzu
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000); // 20 sekund timeout
    
    try {
      // Poslat požadavek na API server
      const response = await fetch('http://localhost:5001/ocr', {
        method: 'POST',
        // @ts-ignore - ignorovat typovou nekompatibilitu AbortSignal
        body: form,
        // @ts-ignore - ignorovat typovou nekompatibilitu AbortSignal
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      
      // Zpracovat odpověď
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Handwritten Text Recognition API error: ${errorText}`);
        return {
          success: false,
          text: '',
          error: `Handwritten Text Recognition API error: ${errorText}`
        };
      }
      
      const result = await response.json() as OCRResult;
      console.log(`Handwritten Text Recognition processing complete. Text length: ${result.text?.length || 0}, Confidence: ${result.confidence || 0}`);
      return result;
    } catch (error: any) {
      clearTimeout(timeout);
      
      if (error.name === 'AbortError') {
        console.error('Handwritten Text Recognition request timed out');
        return {
          success: false,
          text: '',
          error: 'Process timeout (20 seconds) - OCR processing is taking too long. Zkuste metodu "Rychlé OCR".'
        };
      }
      
      console.error(`Error calling Handwritten Text Recognition API: ${error}`);
      return {
        success: false,
        text: '',
        error: `Error calling Handwritten Text Recognition API: ${error.message}`
      };
    }
  } catch (error: any) {
    console.error(`Error during Handwritten Text Recognition processing: ${error}`);
    return {
      success: false,
      text: '',
      error: `Error during Handwritten Text Recognition processing: ${error.message}`
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
  const tmpDir = path.join(os.tmpdir(), 'welldiary-uploads');
  
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