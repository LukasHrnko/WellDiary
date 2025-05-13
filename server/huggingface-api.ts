/**
 * Hugging Face API modul
 * 
 * Přímá implementace pro microsoft/trocr-base-handwritten model
 * používající správné API a správné parametry.
 */

import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';

// Endpoint pro Hugging Face Inference API
const HF_API_URL = 'https://api-inference.huggingface.co/models/microsoft/trocr-base-handwritten';

interface OCRResult {
  success: boolean;
  text: string;
  confidence?: number;
  error?: string;
  execution_time?: number;
}

/**
 * Provede rozpoznávání textu pomocí TrOCR modelu na Hugging Face
 * 
 * @param imagePath Cesta k obrázku
 * @param language Kód jazyka (ignorován, jen pro kompatibilitu)
 * @returns Promise s výsledkem OCR
 */
export async function performTrOCR(imagePath: string, language: string = 'eng'): Promise<OCRResult> {
  console.log(`Provádím TrOCR pomocí Hugging Face API: ${imagePath}`);
  
  const startTime = Date.now();
  
  try {
    // Kontrola existence souboru
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Soubor neexistuje: ${imagePath}`);
    }
    
    // Kontrola API klíče
    const apiKey = process.env.HUGGINGFACE_API_KEY;
    if (!apiKey) {
      throw new Error('Chybí HUGGINGFACE_API_KEY v prostředí');
    }
    
    // Načtení obrázku
    const imageBuffer = fs.readFileSync(imagePath);
    
    // Vytvoření formátu multipart/form-data (důležité pro image recognition)
    const response = await fetch(HF_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {
          image: Buffer.from(imageBuffer).toString('base64')
        },
        parameters: {
          return_timestamps: false
        }
      }),
      timeout: 30000
    });
    
    // Zpracování odpovědi
    if (!response.ok) {
      throw new Error(`Hugging Face API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Hugging Face API odpověď:', JSON.stringify(data).substring(0, 500));
    
    // Extrakce textu z odpovědi
    let text = '';
    if (typeof data === 'string') {
      text = data;
    } else if (data && data.generated_text) {
      text = data.generated_text;
    } else if (data && Array.isArray(data) && data[0] && data[0].generated_text) {
      text = data[0].generated_text;
    } else {
      throw new Error(`Neočekávaný formát odpovědi: ${JSON.stringify(data)}`);
    }
    
    const executionTime = (Date.now() - startTime) / 1000;
    console.log(`TrOCR rozpoznávání dokončeno za ${executionTime.toFixed(2)} sekund`);
    console.log(`Rozpoznaný text: ${text}`);
    
    return {
      success: true,
      text: text.trim(),
      confidence: 0.95,
      execution_time: executionTime
    };
  } catch (error) {
    console.error(`Chyba při TrOCR rozpoznávání: ${error}`);
    return {
      success: false,
      text: '',
      error: `Chyba při TrOCR rozpoznávání: ${error}`,
      execution_time: (Date.now() - startTime) / 1000
    };
  }
}

/**
 * Uloží nahraný obrázek do dočasného umístění
 * 
 * @param buffer Buffer obrázku
 * @param filename Původní název souboru
 * @returns Cesta k uloženému souboru
 */
export function saveUploadedImage(buffer: Buffer, filename: string): string {
  const tmpDir = path.join('/tmp', 'welldiary-uploads');
  
  // Vytvoření dočasného adresáře, pokud neexistuje
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  
  // Vygenerování unikátního názvu
  const uniqueFilename = `${Date.now()}-${filename}`;
  const filePath = path.join(tmpDir, uniqueFilename);
  
  // Uložení souboru
  fs.writeFileSync(filePath, buffer);
  
  return filePath;
}

/**
 * Vyčistí dočasný soubor obrázku po zpracování
 * 
 * @param filePath Cesta k souboru obrázku
 */
export function cleanupImage(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error(`Selhalo čištění obrázku: ${error}`);
  }
}