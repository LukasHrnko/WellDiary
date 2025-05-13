/**
 * Optimalizované TrOCR-inspired HTR modul (Python bridge)
 * 
 * Tento modul implementuje rozpoznávání rukopisu podobné TrOCR od Microsoftu pomocí 
 * Python bridge a kombinace knihoven OpenCV a pytesseract s paralelním zpracováním
 * a pokročilými technikami předzpracování obrazu pro vyšší přesnost a rychlost.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';

interface HTRResult {
  success: boolean;
  text: string;
  confidence?: number;
  error?: string;
  best_variant?: number;
  best_orientation?: number;
  execution_time?: number;
}

/**
 * Perform optimized TrOCR-inspired HTR (Handwritten Text Recognition) on an image
 * Využívá paralelní zpracování různých variant předzpracování obrazu pro lepší výsledky
 * 
 * @param imagePath Path to the image file
 * @param language Language code (default: 'eng')
 * @returns Promise with HTR result containing text or error
 */
export async function performTrOCR(imagePath: string, language: string = 'eng'): Promise<HTRResult> {
  console.log('Spouštím optimalizované TrOCR zpracování');
  console.log(`Zpracovávám obrázek: ${imagePath}`);
  console.log(`Jazyk: ${language}`);
  
  const startTime = Date.now(); // Měření celkové doby zpracování

  try {
    // Specify the simplified Python script path
    const pythonScriptPath = path.join(process.cwd(), 'server', 'simple_trocr.py');
    
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
    
    // Check if tessdata directory exists
    const tessdataPath = path.join(process.cwd(), 'tessdata');
    if (fs.existsSync(tessdataPath)) {
      console.log(`Nalezena tessdata složka: ${tessdataPath}`);
      // Set TESSDATA_PREFIX environment variable for the child process
      process.env.TESSDATA_PREFIX = tessdataPath;
    } else {
      console.warn(`Tessdata složka nebyla nalezena: ${tessdataPath}`);
    }
    
    // Spawn Python process with improved error handling and optimized timeouts
    const pythonPath = '/home/runner/workspace/.pythonlibs/bin/python3';
    const pythonProcess = spawn(pythonPath, [
      pythonScriptPath,
      imagePath,
      language
    ], {
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    });
    
    // Collect stdout data
    let stdoutData = '';
    let stderrData = '';
    
    pythonProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdoutData += chunk;
      // Omezený výstup pro přehlednost logů
      if (chunk.includes('Paralelní zpracování') || chunk.includes('Nalezeno') || chunk.includes('Celkový čas')) {
        console.log(`Python stdout: ${chunk}`);
      }
    });
    
    pythonProcess.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderrData += chunk;
      console.error(`Python stderr: ${chunk}`);
    });
    
    // Return a promise that resolves when the Python process exits
    return new Promise<HTRResult>((resolve) => {
      // Set a timeout in case Python process hangs - zkráceno na 60 sekund díky optimalizacím
      const timeout = setTimeout(() => {
        console.error('Python proces - timeout po 60 sekundách');
        pythonProcess.kill();
        resolve({
          success: false,
          text: '',
          error: 'Timeout (60 sekund) - OCR zpracování trvá příliš dlouho. Zkuste použít zmenšený obrázek.'
        });
      }, 60000);
      
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
          // Hledáme výstup JSON (může být obklopen jinými logy)
          const lines = stdoutData.trim().split('\n');
          // Poslední řádek by měl obsahovat JSON výstup
          const lastLine = lines[lines.length - 1];
          
          try {
            // Pokus o zpracování JSON
            const result = JSON.parse(lastLine) as HTRResult;
            console.log(`Rozpoznávání dokončeno: úspěch=${result.success}, délka textu=${result.text?.length || 0}, důvěryhodnost=${result.confidence?.toFixed(2) || 0}`);
            
            // Přidání času zpracování, pokud nebyl zahrnut ve výsledku
            if (!result.execution_time) {
              result.execution_time = processingTime;
            }
            
            resolve(result);
            return;
          } catch (parseError: any) {
            console.error('Chyba parsování JSON výstupu:', parseError);
            // Pokračujeme k záložnímu postupu
          }
          
          // Záložní postup - vyhledání JSON kdekoli ve výstupu (bez dotAll vlajky)
          // Hledání sekvence začínající { a končící }, může obsahovat cokoli mezi tím
          const openBraceIndex = stdoutData.lastIndexOf('{');
          if (openBraceIndex !== -1) {
            const possibleJson = stdoutData.substring(openBraceIndex);
            const closeBraceIndex = possibleJson.indexOf('}');
            if (closeBraceIndex !== -1) {
              const extractedJson = possibleJson.substring(0, closeBraceIndex + 1);
              try {
                const result = JSON.parse(extractedJson) as HTRResult;
                console.log(`Záložní zpracování JSON: nalezen výsledek pomocí extrakce`);
                
                if (!result.execution_time) {
                  result.execution_time = processingTime;
                }
                
                resolve(result);
                return;
              } catch (matchError: any) {
                console.error('Chyba parsování extrahovaného JSON:', matchError);
              }
            }
          }
          
          // Pokud vše selže, vrátíme chybu
          resolve({ 
            success: false, 
            text: '', 
            error: `Nepodařilo se zpracovat výstup Python skriptu. Poslední řádek: ${lastLine?.substring(0, 200)}...` 
          });
        } catch (error: any) {
          console.error(`Chyba během zpracování Python výstupu: ${error}`);
          resolve({ 
            success: false, 
            text: '', 
            error: `Chyba během zpracování Python výstupu: ${error}. Výstup: ${stdoutData.substring(0, 200)}...` 
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
  } catch (error: any) {
    console.error(`Chyba během TrOCR zpracování: ${error}`);
    return {
      success: false,
      text: '',
      error: `Chyba během TrOCR zpracování: ${error}`
    };
  } finally {
    // Vždy uklidíme dočasné soubory
    try {
      cleanupImage(imagePath);
    } catch (cleanupError) {
      console.error('Chyba při čištění dočasných souborů:', cleanupError);
    }
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