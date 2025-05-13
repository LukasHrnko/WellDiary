/**
 * TrOCR-inspired HTR modul (Python bridge)
 * 
 * Tento modul implementuje rozpoznávání rukopisu podobné TrOCR od Microsoftu pomocí 
 * Python bridge a kombinace knihoven OpenCV a pytesseract
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
}

/**
 * Perform TrOCR-inspired HTR (Handwritten Text Recognition) on an image
 * 
 * @param imagePath Path to the image file
 * @param language Language code (default: 'eng')
 * @returns Promise with HTR result containing text or error
 */
export async function performTrOCR(imagePath: string, language: string = 'eng'): Promise<HTRResult> {
  console.log('Starting TrOCR processing');
  console.log(`Processing image: ${imagePath}`);
  console.log(`Language: ${language}`);

  try {
    // Make Python script executable
    await fs.promises.chmod(path.join(process.cwd(), 'server', 'trocr.py'), 0o755);
    
    // Spawn Python process
    const pythonProcess = spawn('python3', [
      path.join(process.cwd(), 'server', 'trocr.py'),
      imagePath,
      language
    ]);
    
    // Collect stdout data
    let stdoutData = '';
    let stderrData = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
      console.error(`Python stderr: ${data}`);
    });
    
    // Return a promise that resolves when the Python process exits
    return new Promise((resolve, reject) => {
      pythonProcess.on('close', (code) => {
        console.log(`Python process exited with code ${code}`);
        
        if (code !== 0) {
          console.error(`Python error: ${stderrData}`);
          reject({ 
            success: false, 
            text: '', 
            error: `Python process failed with code ${code}: ${stderrData}` 
          });
          return;
        }
        
        try {
          const result = JSON.parse(stdoutData) as HTRResult;
          console.log(`TrOCR processing complete. Confidence: ${result.confidence}`);
          resolve(result);
        } catch (error) {
          console.error(`Failed to parse Python output: ${error}`);
          reject({ 
            success: false, 
            text: '', 
            error: `Failed to parse Python output: ${error}. Output: ${stdoutData}` 
          });
        }
      });
      
      pythonProcess.on('error', (error) => {
        console.error(`Failed to start Python process: ${error}`);
        reject({ 
          success: false, 
          text: '', 
          error: `Failed to start Python process: ${error}` 
        });
      });
    });
  } catch (error) {
    console.error(`Error during TrOCR processing: ${error}`);
    return {
      success: false,
      text: '',
      error: `Error during TrOCR processing: ${error}`
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