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
    // Specify the Python script path
    const pythonScriptPath = path.join(process.cwd(), 'server', 'trocr.py');
    
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
    
    // Spawn Python process with improved error handling
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
      console.log(`Python stdout: ${chunk.substring(0, 200)}${chunk.length > 200 ? '...' : ''}`);
    });
    
    pythonProcess.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderrData += chunk;
      console.error(`Python stderr: ${chunk}`);
    });
    
    // Return a promise that resolves when the Python process exits
    return new Promise<HTRResult>((resolve) => {
      // Set a timeout in case Python process hangs
      const timeout = setTimeout(() => {
        console.error('Python process timeout after 60 seconds');
        pythonProcess.kill();
        resolve({
          success: false,
          text: '',
          error: 'Process timeout (60 seconds)'
        });
      }, 60000);
      
      pythonProcess.on('close', (code) => {
        clearTimeout(timeout);
        console.log(`Python process exited with code ${code}`);
        
        if (code !== 0) {
          console.error(`Python error: ${stderrData}`);
          resolve({ 
            success: false, 
            text: '', 
            error: `Python process failed with code ${code}: ${stderrData.substring(0, 500)}${stderrData.length > 500 ? '...' : ''}` 
          });
          return;
        }
        
        try {
          // Look for JSON in the output (might be surrounded by other logs)
          const jsonMatch = stdoutData.match(/(\{.*\})/s);
          
          if (jsonMatch && jsonMatch[1]) {
            try {
              // Parse the JSON output
              const result = JSON.parse(jsonMatch[1]) as HTRResult;
              console.log(`Recognition result: success=${result.success}, text length=${result.text?.length || 0}, confidence=${result.confidence}`);
              resolve(result);
              return;
            } catch (error: any) {
              console.error('Failed to parse matched JSON:', error, 'in:', jsonMatch[1].substring(0, 100));
              // Continue to try parsing the full output
            }
          }
          
          // Try to parse the entire output as JSON (fallback)
          const result = JSON.parse(stdoutData) as HTRResult;
          console.log(`TrOCR processing complete. Confidence: ${result.confidence}, text length: ${result.text?.length || 0}`);
          resolve(result);
        } catch (error: any) {
          console.error(`Failed to parse Python output: ${error}`);
          resolve({ 
            success: false, 
            text: '', 
            error: `Failed to parse Python output: ${error}. Output: ${stdoutData.substring(0, 200)}...` 
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