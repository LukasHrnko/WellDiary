/**
 * Lightweight OCR module (Python bridge)
 * 
 * Tento modul implementuje velmi jednoduché OCR pomocí 
 * Python bridge a zaměřuje se na rychlost před přesností.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';

interface OCRResult {
  success: boolean;
  text: string;
  confidence?: number;
  error?: string;
}

/**
 * Perform quick OCR on an image
 * 
 * @param imagePath Path to the image file
 * @param language Language code (default: 'eng')
 * @returns Promise with OCR result containing text or error
 */
export async function performQuickOCR(imagePath: string, language: string = 'eng'): Promise<OCRResult> {
  console.log('Starting quick OCR processing');
  console.log(`Processing image: ${imagePath}`);
  console.log(`Language: ${language}`);

  try {
    // Specify the Python script path
    const pythonScriptPath = path.join(process.cwd(), 'server', 'light-ocr.py');
    
    // Check if Python script exists
    if (!fs.existsSync(pythonScriptPath)) {
      console.error(`Python script not found at: ${pythonScriptPath}`);
      return {
        success: false,
        text: '',
        error: `Python script not found at: ${pythonScriptPath}`
      };
    }
    
    // Check if input image exists
    if (!fs.existsSync(imagePath)) {
      console.error(`Input image not found at: ${imagePath}`);
      return {
        success: false,
        text: '',
        error: `Input image not found at: ${imagePath}`
      };
    }
    
    console.log(`Using Python script at: ${pythonScriptPath}`);
    
    // Make Python script executable
    await fs.promises.chmod(pythonScriptPath, 0o755);
    
    // Check if tessdata directory exists
    const tessdataPath = path.join(process.cwd(), 'tessdata');
    if (fs.existsSync(tessdataPath)) {
      console.log(`Found tessdata directory at: ${tessdataPath}`);
      // Set TESSDATA_PREFIX environment variable for the child process
      process.env.TESSDATA_PREFIX = tessdataPath;
    } else {
      console.warn(`Tessdata directory not found at: ${tessdataPath}`);
    }
    
    // Spawn Python process with minimal options
    const pythonProcess = spawn('python3', [
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
      console.log(`Python stdout: ${chunk.substring(0, 100)}${chunk.length > 100 ? '...' : ''}`);
    });
    
    pythonProcess.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderrData += chunk;
      console.error(`Python stderr: ${chunk}`);
    });
    
    // Return a promise that resolves when the Python process exits
    return new Promise<OCRResult>((resolve) => {
      // Set a short timeout to fail fast
      const timeout = setTimeout(() => {
        console.error('Python process timeout after 15 seconds');
        pythonProcess.kill();
        resolve({
          success: false,
          text: '',
          error: 'Process timeout (15 seconds) - OCR processing is taking too long'
        });
      }, 15000);
      
      pythonProcess.on('close', (code) => {
        clearTimeout(timeout);
        console.log(`Python process exited with code ${code}`);
        
        if (code !== 0) {
          console.error(`Python error: ${stderrData}`);
          resolve({ 
            success: false, 
            text: '', 
            error: `Python process failed with code ${code}: ${stderrData.substring(0, 300)}${stderrData.length > 300 ? '...' : ''}` 
          });
          return;
        }
        
        try {
          // Try to parse JSON from the output
          const jsonMatch = stdoutData.match(/(\{.*\})/);
          
          if (jsonMatch && jsonMatch[1]) {
            try {
              // Parse the JSON output
              const result = JSON.parse(jsonMatch[1]) as OCRResult;
              console.log(`Recognition result: success=${result.success}, text length=${result.text?.length || 0}, confidence=${result.confidence}`);
              resolve(result);
              return;
            } catch (error: any) {
              console.error('Failed to parse matched JSON:', error);
              // Continue to try parsing the full output
            }
          }
          
          // Try to parse the entire output as JSON (fallback)
          const result = JSON.parse(stdoutData) as OCRResult;
          console.log(`OCR processing complete. Text length: ${result.text?.length || 0}`);
          resolve(result);
        } catch (error: any) {
          console.error(`Failed to parse Python output: ${error}`);
          resolve({ 
            success: false, 
            text: '', 
            error: `Failed to parse Python output: ${error.message}` 
          });
        }
      });
      
      pythonProcess.on('error', (error) => {
        clearTimeout(timeout);
        console.error(`Failed to start Python process: ${error}`);
        resolve({ 
          success: false, 
          text: '', 
          error: `Failed to start Python process: ${error}` 
        });
      });
    });
  } catch (error: any) {
    console.error(`Error during OCR processing: ${error}`);
    return {
      success: false,
      text: '',
      error: `Error during OCR processing: ${error}`
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