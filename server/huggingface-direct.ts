/**
 * Hugging Face Inference API - přímé volání
 * 
 * Implementace založená na správném volání Hugging Face Inference API
 * pro microsoft/trocr-base-handwritten model.
 */

import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';
import FormData from 'form-data';

interface OCRResult {
  success: boolean;
  text: string;
  confidence?: number;
  error?: string;
  execution_time?: number;
}

/**
 * Provede rozpoznávání textu pomocí microsoft/trocr-base-handwritten
 * 
 * @param imagePath Cesta k obrázku
 * @param language Kód jazyka (ignorován, jen pro kompatibilitu)
 * @returns Promise s výsledkem OCR
 */
export async function performTrOCR(imagePath: string, language: string = 'eng'): Promise<OCRResult> {
  console.log(`Provádím TrOCR přes Hugging Face Inference API: ${imagePath}`);
  
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
    
    // Příprava formdata s obrázkem
    const form = new FormData();
    form.append('file', fs.createReadStream(imagePath));
    
    // Endpoint pro tento model vyžaduje multipart/form-data s obrázkem
    const response = await fetch(
      'https://api-inference.huggingface.co/models/microsoft/trocr-base-handwritten',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          // Nenastavaujeme Content-Type, FormData si to nastaví sama
        },
        body: form,
        timeout: 30000
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Hugging Face API vrátila chybu: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    // Parsování odpovědi
    const result = await response.json();
    console.log('Odpověď z API:', JSON.stringify(result).substring(0, 500));
    
    let text = '';
    
    // Různé formáty odpovědi, které API může vracet
    if (typeof result === 'string') {
      text = result;
    } else if (result && typeof result.text === 'string') {
      text = result.text;
    } else if (result && result.generated_text) {
      text = result.generated_text;
    } else if (Array.isArray(result) && result.length > 0) {
      if (typeof result[0] === 'string') {
        text = result[0];
      } else if (result[0] && result[0].generated_text) {
        text = result[0].generated_text;
      }
    } else {
      console.warn('Neznámý formát odpovědi:', JSON.stringify(result));
      text = JSON.stringify(result);
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