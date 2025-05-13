/**
 * Skutečný TrOCR modul (Microsoft Transformer OCR)
 * 
 * Tento modul komunikuje s Python serverem, který používá skutečný
 * Microsoft TrOCR model z Hugging Face (microsoft/trocr-base-handwritten)
 * pro rozpoznávání textu z rukopisu.
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import fetch from 'node-fetch';
import FormData from 'form-data';

// Port, na kterém běží Python TrOCR server
const TROCR_SERVER_PORT = 5500;
const TROCR_SERVER_URL = `http://localhost:${TROCR_SERVER_PORT}`;

interface OCRResult {
  success: boolean;
  text: string;
  confidence?: number;
  error?: string;
  execution_time?: number;
}

// Server process
let serverProcess: any = null;

/**
 * Spustí TrOCR Python server, pokud ještě neběží
 */
async function ensureServerRunning(): Promise<boolean> {
  if (serverProcess) {
    return true;
  }
  
  console.log('Spouštím TrOCR Python server...');
  
  try {
    // Zkontrolujte, zda server už běží
    try {
      const response = await fetch(`${TROCR_SERVER_URL}/health`, { timeout: 1000 });
      if (response.ok) {
        console.log('TrOCR server už běží');
        return true;
      }
    } catch (error) {
      // Server není spuštěn, budeme ho muset spustit
    }
    
    // Cesta k Python skriptu
    const scriptPath = path.join(process.cwd(), 'server', 'trocr_server.py');
    
    // Zkontrolujte, zda skript existuje
    if (!fs.existsSync(scriptPath)) {
      console.error(`Python skript nebyl nalezen: ${scriptPath}`);
      return false;
    }
    
    // Spuštění Python serveru
    serverProcess = spawn('python3', [
      scriptPath,
      TROCR_SERVER_PORT.toString()
    ], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    // Zaznamenávání výstupu pro debugování
    serverProcess.stdout.on('data', (data: Buffer) => {
      console.log(`TrOCR server stdout: ${data.toString()}`);
    });
    
    serverProcess.stderr.on('data', (data: Buffer) => {
      console.error(`TrOCR server stderr: ${data.toString()}`);
    });
    
    // Zpracování ukončení procesu
    serverProcess.on('close', (code: number) => {
      console.log(`TrOCR server ukončen s kódem ${code}`);
      serverProcess = null;
    });
    
    serverProcess.on('error', (error: Error) => {
      console.error(`Chyba při spouštění TrOCR serveru: ${error}`);
      serverProcess = null;
    });
    
    // Počkejte, až server začne reagovat
    for (let i = 0; i < 10; i++) {
      try {
        const response = await fetch(`${TROCR_SERVER_URL}/health`, { timeout: 2000 });
        if (response.ok) {
          console.log('TrOCR server úspěšně spuštěn');
          return true;
        }
      } catch (error) {
        // Zkusit znovu po krátké pauze
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.error('Nepodařilo se spustit TrOCR server');
    return false;
  } catch (error) {
    console.error(`Chyba při spouštění TrOCR serveru: ${error}`);
    return false;
  }
}

/**
 * Perform Microsoft TrOCR (Transformer OCR) on an image
 * 
 * @param imagePath Path to the image file
 * @param language Language code (default: 'eng')
 * @returns Promise with OCR result containing text or error
 */
export async function performTrOCR(imagePath: string, language: string = 'eng'): Promise<OCRResult> {
  console.log(`Provádím TrOCR pro: ${imagePath}`);
  console.log(`Jazyk: ${language}`);
  
  const startTime = Date.now();
  
  try {
    // Zkontrolujte, zda obrázek existuje
    if (!fs.existsSync(imagePath)) {
      console.error(`Vstupní obrázek nebyl nalezen: ${imagePath}`);
      return {
        success: false,
        text: '',
        error: `Vstupní obrázek nebyl nalezen: ${imagePath}`
      };
    }
    
    // Zajistěte, že server běží
    const serverRunning = await ensureServerRunning();
    if (!serverRunning) {
      return {
        success: false,
        text: '',
        error: 'Nepodařilo se spustit TrOCR server'
      };
    }
    
    // Připravte FormData pro HTTP požadavek
    const formData = new FormData();
    formData.append('image', fs.createReadStream(imagePath));
    formData.append('language', language);
    
    // Odešlete požadavek na OCR server
    const response = await fetch(`${TROCR_SERVER_URL}/ocr`, {
      method: 'POST',
      body: formData,
      timeout: 30000 // 30 sekund timeout
    });
    
    // Zpracujte odpověď
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`TrOCR server vrátil chybu: ${response.status} ${response.statusText}`);
      console.error(`Error details: ${errorText}`);
      return {
        success: false,
        text: '',
        error: `TrOCR server vrátil chybu: ${response.status} ${response.statusText}`
      };
    }
    
    // Parsujte JSON z odpovědi
    const result = await response.json() as OCRResult;
    
    // Přidejte čas zpracování
    const processingTime = (Date.now() - startTime) / 1000;
    console.log(`TrOCR dokončeno za ${processingTime.toFixed(2)} sekund`);
    console.log(`Rozpoznaný text: ${result.text}`);
    
    return {
      ...result,
      execution_time: processingTime
    };
  } catch (error) {
    console.error(`Chyba během TrOCR zpracování: ${error}`);
    return {
      success: false,
      text: '',
      error: `Chyba během TrOCR zpracování: ${error}`
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