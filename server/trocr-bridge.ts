/**
 * Skutečný TrOCR (Microsoft Transformer OCR) modul přes Python bridge
 * 
 * Tento modul implementuje most mezi Node.js a Python skriptem,
 * který využívá oficiální TrOCR model z knihovny transformers
 * pro nejkvalitnější rozpoznávání rukopisu.
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
 * Perform Microsoft TrOCR handwritten text recognition using Python bridge
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
    // Specify the Python script path
    const pythonScriptPath = path.join(process.cwd(), 'server', 'trocr.py');
    
    // Check if Python script exists
    if (!fs.existsSync(pythonScriptPath)) {
      console.error(`Python skript nebyl nalezen: ${pythonScriptPath}`);
      return {
        success: false,
        text: '',
        error: `Python skript nebyl nalezen: ${pythonScriptPath}`
      };
    }
    
    // Check if input image exists
    if (!fs.existsSync(imagePath)) {
      console.error(`Vstupní obrázek nebyl nalezen: ${imagePath}`);
      return {
        success: false,
        text: '',
        error: `Vstupní obrázek nebyl nalezen: ${imagePath}`
      };
    }
    
    console.log(`Používám Python skript: ${pythonScriptPath}`);
    
    // Make Python script executable
    await fs.promises.chmod(pythonScriptPath, 0o755);
    
    // Spawn Python process
    const pythonProcess = spawn('python3', [
      pythonScriptPath,
      imagePath,
      '--language', language
    ]);
    
    // Collect stdout data
    let stdoutData = '';
    let stderrData = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
      console.error(`Python stderr: ${data.toString()}`);
    });
    
    // Return a promise that resolves when the Python process exits
    return new Promise<OCRResult>((resolve) => {
      // Set a timeout in case Python process hangs
      const timeout = setTimeout(() => {
        console.error('Python proces - timeout po 120 sekundách');
        pythonProcess.kill();
        resolve({
          success: false,
          text: '',
          error: 'Timeout (120 sekund) - TrOCR zpracování trvá příliš dlouho. Zkuste použít zmenšený obrázek.'
        });
      }, 120000); // 2 minuty - TrOCR načítání může trvat déle
      
      pythonProcess.on('close', (code) => {
        clearTimeout(timeout);
        const processingTime = (Date.now() - startTime) / 1000; // v sekundách
        console.log(`Python proces dokončen s kódem ${code} za ${processingTime.toFixed(2)} sekund`);
        
        if (code !== 0) {
          console.error(`Python chyba: ${stderrData}`);
          resolve({ 
            success: false, 
            text: '', 
            error: `Python proces selhal s kódem ${code}: ${stderrData.substring(0, 500)}${stderrData.length > 500 ? '...' : ''}` 
          });
          return;
        }
        
        try {
          // Parse JSON output from Python script
          const result = JSON.parse(stdoutData.trim());
          console.log(`Rozpoznávání dokončeno: úspěch=${result.success}, délka textu=${result.text?.length || 0}`);
          
          // Add processing time if not included in the result
          if (!result.execution_time) {
            result.execution_time = processingTime;
          }
          
          resolve(result);
        } catch (error) {
          console.error(`Chyba při parsování JSON výstupu: ${error}`);
          resolve({ 
            success: false, 
            text: '', 
            error: `Chyba při parsování výstupu: ${error}` 
          });
        }
      });
      
      pythonProcess.on('error', (error) => {
        clearTimeout(timeout);
        console.error(`Nepodařilo se spustit Python proces: ${error}`);
        resolve({ 
          success: false, 
          text: '', 
          error: `Nepodařilo se spustit Python proces: ${error}` 
        });
      });
    });
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