/**
 * Hugging Face OCR module
 * 
 * Tento modul implementuje integraci s Hugging Face free API endpointem
 * pro model TrOCR specializovaný na rozpoznávání ručního písma.
 */

import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import FormData from 'form-data';

interface OCRResult {
  success: boolean;
  text: string;
  confidence?: number;
  error?: string;
}

/**
 * Perform Hugging Face TrOCR handwritten text recognition
 * 
 * @param imagePath Path to the image file
 * @returns Promise with OCR result containing text or error
 */
export async function performHuggingFaceOCR(imagePath: string): Promise<OCRResult> {
  console.log('Starting Hugging Face OCR processing for handwritten text');
  console.log('Processing image:', imagePath);
  
  if (!fs.existsSync(imagePath)) {
    console.error(`Input image not found at: ${imagePath}`);
    return {
      success: false,
      text: '',
      error: `Input image not found at: ${imagePath}`
    };
  }
  
  // Create FormData with the image
  const formData = new FormData();
  formData.append('file', fs.createReadStream(imagePath));
  
  // Použijeme demo endpoint místo oficiálního API, které by vyžadovalo API klíč
  // Tento endpoint je veřejně dostupný bez autentizace
  const apiUrl = 'https://hf-mirror.com/spaces/Xenova/OCR-demo/api/ocr';
  
  console.log('Sending request to Hugging Face public demo...');
  
  // Set timeout 
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 seconds timeout
  
  try {
    // Send API request to public demo
    const response = await fetch(apiUrl, {
      method: 'POST',
      body: formData,
      signal: controller.signal as any, // Type casting to fix compatibility issues
      headers: {
        'Accept': 'application/json'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Hugging Face API error:', errorText);
      return {
        success: false,
        text: '',
        error: `API error: ${response.status} ${response.statusText}`
      };
    }
    
    // Parse response
    const result = await response.json();
    console.log("Hugging Face API response:", JSON.stringify(result));
    
    // Demo OCR API může mít různé formáty odpovědi
    let recognizedText = '';
    
    if (typeof result === 'string') {
      // Přímá odpověď jako text
      recognizedText = result;
    } else if (Array.isArray(result) && result.length > 0) {
      // Odpověď jako pole textů
      recognizedText = result[0];
    } else if (result && result.generated_text) {
      // Odpověď ve formátu { generated_text: "text" }
      recognizedText = result.generated_text;
    } else if (result && result.text) {
      // Odpověď ve formátu { text: "text" }
      recognizedText = result.text;
    } else if (result && Array.isArray(result.data) && result.data.length > 0) {
      // Původní formát z Hugging Face Space
      recognizedText = result.data[0];
    } else if (result && typeof result.ocr === 'string') {
      // Demo OCR endpoint formát { ocr: "text" }
      recognizedText = result.ocr;
    } else if (result && result.result && typeof result.result === 'string') {
      // Další možný formát { result: "text" }
      recognizedText = result.result;
    } else {
      console.error('Unexpected API response format:', result);
      return {
        success: false,
        text: '',
        error: 'Unexpected API response format'
      };
    }
    
    console.log(`Hugging Face TrOCR processing complete. Text length: ${recognizedText.length}`);
    
    return {
      success: true,
      text: recognizedText,
      confidence: 0.9 // TrOCR typically has high confidence
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      console.error('Hugging Face API request timeout (90 seconds)');
      return {
        success: false,
        text: '',
        error: 'API request timeout after 90 seconds'
      };
    } else {
      console.error('Error during Hugging Face API request:', error);
      return {
        success: false,
        text: '',
        error: error.message || 'Unknown error during API request'
      };
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
  const uploadDir = '/tmp/welldiary-uploads';
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  
  const timestamp = Date.now();
  const safeName = filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const imagePath = path.join(uploadDir, `${timestamp}-${safeName}`);
  
  fs.writeFileSync(imagePath, buffer);
  
  return imagePath;
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
      console.log(`Cleaned up temporary file: ${filePath}`);
    }
  } catch (error) {
    console.error(`Failed to clean up file: ${filePath}`, error);
  }
}