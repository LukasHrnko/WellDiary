/**
 * Optimalizované TrOCR-inspired HTR modul (Node.js implementace)
 * 
 * Tento modul implementuje rozpoznávání rukopisu pomocí Node.js a tesseract.js
 * Optimalizováno pro lepší rozpoznávání českého rukopisu.
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

interface HTRResult {
  success: boolean;
  text: string;
  confidence?: number;
  error?: string;
  execution_time?: number;
}

/**
 * Perform optimized TrOCR-inspired HTR (Handwritten Text Recognition) on an image
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
    // Specify the Node.js script path
    const nodeTrocrPath = path.join(process.cwd(), 'server', 'node_trocr.js');
    
    // Check if Node.js script exists
    if (!fs.existsSync(nodeTrocrPath)) {
      console.error(`Node.js skript nebyl nalezen: ${nodeTrocrPath}`);
      return {
        success: false,
        text: '',
        error: `Node.js skript nebyl nalezen: ${nodeTrocrPath}`
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
    
    console.log(`Používám Node.js skript: ${nodeTrocrPath}`);
    
    // Spawn Node.js process with improved error handling and optimized timeouts
    const nodeProcess = spawn('node', [
      nodeTrocrPath,
      imagePath,
      language
    ], {
      env: { ...process.env }
    });
    
    // Collect stdout data
    let stdoutData = '';
    let stderrData = '';
    
    nodeProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdoutData += chunk;
    });
    
    nodeProcess.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderrData += chunk;
      console.error(`Node.js stderr: ${chunk}`);
    });
    
    // Return a promise that resolves when the Node.js process exits
    return new Promise<HTRResult>((resolve) => {
      // Set a timeout in case Node.js process hangs
      const timeout = setTimeout(() => {
        console.error('Node.js proces - timeout po 60 sekundách');
        nodeProcess.kill();
        resolve({
          success: false,
          text: '',
          error: 'Timeout (60 sekund) - OCR zpracování trvá příliš dlouho. Zkuste použít zmenšený obrázek.'
        });
      }, 60000);
      
      nodeProcess.on('close', (code) => {
        clearTimeout(timeout);
        const processingTime = (Date.now() - startTime) / 1000; // v sekundách
        console.log(`Node.js proces dokončen s kódem ${code} za ${processingTime.toFixed(2)} sekund`);
        
        if (code !== 0) {
          console.error(`Node.js chyba: ${stderrData}`);
          resolve({ 
            success: false, 
            text: '', 
            error: `Node.js proces selhal s kódem ${code}: ${stderrData.substring(0, 500)}${stderrData.length > 500 ? '...' : ''}` 
          });
          return;
        }
        
        try {
          // Parse JSON output from Node.js script
          const result = JSON.parse(stdoutData);
          console.log(`Rozpoznávání dokončeno: úspěch=${result.success}, délka textu=${result.text?.length || 0}, důvěryhodnost=${result.confidence?.toFixed(2) || 0}`);
          
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
      
      nodeProcess.on('error', (error) => {
        clearTimeout(timeout);
        console.error(`Nepodařilo se spustit Node.js proces: ${error}`);
        resolve({ 
          success: false, 
          text: '', 
          error: `Nepodařilo se spustit Node.js proces: ${error}` 
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