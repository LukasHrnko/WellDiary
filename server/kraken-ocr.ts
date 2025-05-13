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
 * Spustí Python skript přímo pro rozpoznávání textu
 * 
 * @param imagePath Cesta k souboru s obrázkem
 * @param language Kód jazyka (výchozí: 'eng')
 * @returns OCR výsledek
 */
async function runPythonOCR(imagePath: string, language: string = 'eng'): Promise<OCRResult> {
  return new Promise<OCRResult>((resolve) => {
    // Připravíme Python skript jako multi-line string s veškerým potřebným kódem
    const pythonCode = `
import sys
import json
import cv2
import numpy as np
import pytesseract
from pytesseract import Output
import os
from PIL import Image, ImageEnhance, ImageFilter

# Nastavení cesty k tessdata
os.environ['TESSDATA_PREFIX'] = os.path.join(os.getcwd(), 'tessdata')

def preprocess_image(image_path):
    image = cv2.imread(image_path)
    if image is None:
        return None
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    processed = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
    )
    return processed

def perform_adaptive_preprocessing(image_path):
    try:
        image = cv2.imread(image_path)
        if image is None:
            return []
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        variants = []
        
        # Basic adaptive thresholding
        thresh1 = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
        )
        variants.append(thresh1)
        
        # Stronger adaptive thresholding
        thresh2 = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 15, 5
        )
        variants.append(thresh2)
        
        # Advanced image processing with PIL
        try:
            pil_img = Image.fromarray(gray)
            enhancer = ImageEnhance.Contrast(pil_img)
            enhanced_img = enhancer.enhance(2.0)
            enhanced_img = enhanced_img.filter(ImageFilter.SHARPEN)
            enhanced_array = np.array(enhanced_img)
            _, thresh3 = cv2.threshold(enhanced_array, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            variants.append(thresh3)
        except Exception as e:
            print(f"Error during PIL processing: {str(e)}")
            
        return variants
    except Exception as e:
        print(f"Error during preprocessing: {str(e)}")
        return []

def recognize_handwritten_text(image_path, language='eng'):
    try:
        if language != 'eng' and not os.path.exists(os.path.join(os.environ['TESSDATA_PREFIX'], f'{language}.traineddata')):
            print(f"Warning: Training data for {language} not found, falling back to eng")
            language = 'eng'

        # Get preprocessed variants
        preprocessed_variants = perform_adaptive_preprocessing(image_path)
        if not preprocessed_variants:
            basic_processed = preprocess_image(image_path)
            if basic_processed is None:
                return {
                    "success": False,
                    "error": "Failed to preprocess image"
                }
            preprocessed_variants = [basic_processed]
        
        # Configure Tesseract parameters
        psm_modes = [6, 4] 
        oem_modes = [1, 3]  
        
        best_result = {
            "text": "",
            "confidence": 0.0
        }
        
        # Try different combinations
        for processed_image in preprocessed_variants:
            for psm in psm_modes:
                for oem in oem_modes:
                    config = f'--oem {oem} --psm {psm} -l {language}'
                    
                    try:
                        data = pytesseract.image_to_data(processed_image, config=config, output_type=Output.DICT)
                        text_parts = []
                        confidence_sum = 0
                        confidence_count = 0
                        
                        for i in range(len(data['text'])):
                            if data['text'][i].strip():
                                text_parts.append(data['text'][i])
                                confidence_sum += float(data['conf'][i])
                                confidence_count += 1
                        
                        if confidence_count == 0:
                            text = pytesseract.image_to_string(processed_image, config=config)
                            confidence = 0.5
                        else:
                            text = ' '.join(text_parts)
                            confidence = confidence_sum / confidence_count / 100.0
                        
                        if (confidence > best_result["confidence"] or 
                           (abs(confidence - best_result["confidence"]) < 0.1 and len(text) > len(best_result["text"]))):
                            best_result["text"] = text
                            best_result["confidence"] = confidence
                            
                    except Exception as e:
                        print(f"Error in OCR attempt (psm={psm}, oem={oem}): {str(e)}")
        
        if best_result["text"]:
            return {
                "success": True,
                "text": best_result["text"],
                "confidence": best_result["confidence"]
            }
        else:
            return {
                "success": False,
                "error": "Failed to recognize text with any configuration"
            }
    except Exception as e:
        return {
            "success": False,
            "error": f"Handwritten text recognition failed: {str(e)}"
        }

# Process the image
result = recognize_handwritten_text('${imagePath}', '${language}')
print(json.dumps(result))
`;

    // Nastavit timeout - pokud proces běží déle než 25 sekund, ukončíme ho
    let isResolved = false;
    
    // Spustit Python proces pro přímé zpracování
    const pythonProcess = spawn('python3', ['-c', pythonCode]);
    
    const timeoutId = setTimeout(() => {
      if (!isResolved) {
        try {
          pythonProcess.kill();
        } catch (e) {
          console.error('Error killing process:', e);
        }
        console.error('OCR Process timeout - killing process');
        isResolved = true;
        resolve({
          success: false,
          text: '',
          error: 'Process timeout (25 seconds) - OCR processing is taking too long. Zkuste metodu "Rychlé OCR".'
        });
      }
    }, 25000);
    
    let resultData = '';
    let errorData = '';
    
    pythonProcess.stdout.on('data', (data: any) => {
      resultData += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data: any) => {
      errorData += data.toString();
      console.error(`OCR Python Error: ${data.toString()}`);
    });
    
    pythonProcess.on('close', (code: number | null) => {
      clearTimeout(timeoutId);
      
      if (isResolved) return;
      
      isResolved = true;
      
      if (code !== 0) {
        console.error(`OCR process exited with code ${code}`);
        resolve({
          success: false,
          text: '',
          error: `OCR process failed with code ${code}: ${errorData}`
        });
        return;
      }
      
      try {
        // Pokusit se najít platný JSON v odpovědi
        let jsonStart = resultData.indexOf('{');
        let jsonEnd = resultData.lastIndexOf('}');
        
        if (jsonStart >= 0 && jsonEnd > jsonStart) {
          const jsonStr = resultData.substring(jsonStart, jsonEnd + 1);
          const result = JSON.parse(jsonStr) as OCRResult;
          resolve(result);
        } else {
          // Žádný JSON nenalezen, vrátime vstupní text jako výsledek
          console.error('No valid JSON found in Python output');
          console.log('Raw output:', resultData);
          
          resolve({
            success: true,
            text: resultData.trim(),
            confidence: 0.5
          });
        }
      } catch (err: any) {
        console.error('Error parsing OCR result:', err);
        resolve({
          success: false,
          text: '',
          error: `Error parsing OCR result: ${err?.message || 'Unknown parsing error'}`
        });
      }
    });
  });
}

/**
 * Perform handwritten text recognition using optimized OCR
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
    // Zkontrolovat, zda vstupní obrázek existuje
    if (!fs.existsSync(imagePath)) {
      console.error(`Input image not found at: ${imagePath}`);
      return {
        success: false,
        text: '',
        error: `Input image not found at: ${imagePath}`
      };
    }
    
    // Spustit Python skript pro OCR přímo
    const result = await runPythonOCR(imagePath, language);
    
    if (result.success) {
      console.log(`Handwritten Text Recognition processing complete. Text length: ${result.text?.length || 0}, Confidence: ${result.confidence || 0}`);
    } else {
      console.error(`Handwritten Text Recognition failed: ${result.error}`);
    }
    
    return result;
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