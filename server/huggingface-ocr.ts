/**
 * Hugging Face TrOCR modul
 * 
 * Tento modul implementuje integraci s Hugging Face API
 * pro model TrOCR specializovaný na rozpoznávání ručního písma.
 */

import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';

const HF_API_URL = "https://api-inference.huggingface.co/models/microsoft/trocr-large-handwritten";

interface OCRResult {
  success: boolean;
  text: string;
  confidence?: number;
  error?: string;
  execution_time?: number;
}

/**
 * Perform Hugging Face TrOCR handwritten text recognition
 * 
 * @param imagePath Path to the image file
 * @returns Promise with OCR result containing text or error
 */
export async function performTrOCR(imagePath: string): Promise<OCRResult> {
  console.log(`Provádím TrOCR s Hugging Face pro: ${imagePath}`);
  const startTime = Date.now();
  
  try {
    // Check if API key is available
    const apiKey = process.env.HUGGINGFACE_API_KEY;
    if (!apiKey) {
      console.error("Chybí HUGGINGFACE_API_KEY v prostředí");
      return {
        success: false,
        text: "",
        error: "Pro použití TrOCR je potřeba API klíč Hugging Face. Kontaktujte administrátora aplikace."
      };
    }
    
    // Check if image exists
    if (!fs.existsSync(imagePath)) {
      console.error(`Soubor nenalezen: ${imagePath}`);
      return {
        success: false,
        text: "",
        error: `Soubor nebyl nalezen: ${imagePath}`
      };
    }
    
    // Read image
    const imageBuffer = fs.readFileSync(imagePath);
    
    // Call Hugging Face API
    console.log("Volám Hugging Face API...");
    const response = await fetch(HF_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        data: [imageBuffer.toString('base64')]
      }),
      timeout: 30000 // 30 seconds timeout
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Hugging Face API vrátila chybu: ${response.status} ${response.statusText}`);
      console.error(`Error details: ${errorText}`);
      return {
        success: false,
        text: "",
        error: `Hugging Face API vrátila chybu: ${response.status} ${response.statusText}`
      };
    }
    
    const result = await response.json();
    const recognizedText = result[0]?.generated_text || "";
    
    // Calculate processing time
    const processingTime = (Date.now() - startTime) / 1000;
    console.log(`TrOCR zpracování dokončeno za ${processingTime.toFixed(2)} sekund`);
    console.log(`Rozpoznaný text: ${recognizedText}`);
    
    return {
      success: true,
      text: recognizedText,
      confidence: 0.9, // TrOCR API nevrací přesnou důvěryhodnost
      execution_time: processingTime
    };
  } catch (error) {
    console.error(`Chyba při zpracování TrOCR: ${error}`);
    
    // Calculate processing time even for errors
    const processingTime = (Date.now() - startTime) / 1000;
    
    return {
      success: false,
      text: "",
      error: `Chyba při zpracování TrOCR: ${error}`,
      execution_time: processingTime
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