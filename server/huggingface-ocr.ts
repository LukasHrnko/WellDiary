/**
 * Hugging Face OCR module
 * 
 * Tento modul implementuje integraci s Hugging Face free API endpointem
 * pro model TrOCR specializovaný na rozpoznávání ručního písma.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import fetch from 'node-fetch';
import FormData from 'form-data';

interface OCRResult {
  success: boolean;
  text: string;
  confidence?: number;
  error?: string;
}

// Cesta pro dočasné soubory
const uploadDir = path.join(os.tmpdir(), 'welldiary-uploads');
// Zajistit, že adresář existuje
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * Perform Hugging Face TrOCR handwritten text recognition
 * 
 * @param imagePath Path to the image file
 * @returns Promise with OCR result containing text or error
 */
export async function performHuggingFaceOCR(imagePath: string): Promise<OCRResult> {
  console.log('Starting Hugging Face TrOCR processing');
  console.log(`Processing image: ${imagePath}`);
  
  try {
    // Check if input image exists
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
    
    // Hugging Face Space URL for NielsRogge/TrOCR-handwriting
    const apiUrl = 'https://nielsrogge-trocr-handwriting.hf.space/api/predict';
    
    console.log('Sending request to Hugging Face...');
    
    // Set timeout 
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 seconds timeout
    
    try {
      // Send API request
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
      
      // Hugging Face Space response format:
      // { "data": ["recognized text"] }
      if (result && result.data && Array.isArray(result.data) && result.data.length > 0) {
        const recognizedText = result.data[0];
        console.log(`Hugging Face TrOCR processing complete. Text length: ${recognizedText.length}`);
        
        return {
          success: true,
          text: recognizedText,
          confidence: 0.9 // TrOCR typically has high confidence
        };
      } else {
        console.error('Unexpected API response format:', result);
        return {
          success: false,
          text: '',
          error: 'Unexpected API response format'
        };
      }
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        console.error('Request timeout after 90 seconds');
        return {
          success: false,
          text: '',
          error: 'Request timeout (90 seconds) - Hugging Face API is not responding'
        };
      }
      
      console.error('Fetch error:', fetchError);
      return {
        success: false,
        text: '',
        error: `Fetch error: ${fetchError.message || 'Unknown error'}`
      };
    }
  } catch (error: any) {
    console.error('Error in Hugging Face OCR:', error);
    return {
      success: false,
      text: '',
      error: `Error: ${error.message || 'Unknown error'}`
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
  const timestamp = Date.now();
  const savedFilename = `${timestamp}-${path.basename(filename)}`;
  const filePath = path.join(uploadDir, savedFilename);
  
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
    console.error(`Error cleaning up image file: ${error.message}`);
  }
}