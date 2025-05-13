/**
 * Jednoduchý Tesseract OCR modul
 * 
 * Tento modul používá Tesseract.js pro rozpoznávání textu z obrázků
 * s minimální konfigurací pro spolehlivé fungování.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createWorker } from 'tesseract.js';

interface OCRResult {
  success: boolean;
  text: string;
  confidence?: number;
  error?: string;
  execution_time?: number;
}

/**
 * Provede rozpoznávání textu s využitím Tesseract.js
 * 
 * @param imagePath Cesta k obrázku
 * @param language Kód jazyka (výchozí: 'eng')
 * @returns Promise s výsledkem OCR
 */
export async function performTrOCR(imagePath: string, language: string = 'eng'): Promise<OCRResult> {
  console.log(`Provádím OCR rozpoznávání pomocí Tesseract: ${imagePath}`);
  
  const startTime = Date.now();
  
  try {
    // Kontrola existence souboru
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Soubor neexistuje: ${imagePath}`);
    }
    
    // Vytvoření a konfigurace Tesseract workeru
    const worker = await createWorker(language);
    
    // Optimální nastavení pro rukopis
    await worker.setParameters({
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÁáČčĎďÉéĚěÍíŇňÓóŘřŠšŤťÚúŮůÝýŽž0123456789.,;:!?()[]{}+-*/=@#$%^&*_<>"\'\\|~` ',
    });
    
    // Spuštění rozpoznávání
    const result = await worker.recognize(imagePath);
    
    // Ukončení workeru
    await worker.terminate();
    
    const executionTime = (Date.now() - startTime) / 1000;
    console.log(`OCR rozpoznávání dokončeno za ${executionTime.toFixed(2)} sekund`);
    console.log(`Rozpoznaný text: ${result.data.text}`);
    
    // Základní postprocessing
    const enhancedText = result.data.text
      .replace(/\\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    return {
      success: true,
      text: enhancedText,
      confidence: result.data.confidence,
      execution_time: executionTime
    };
  } catch (error) {
    console.error(`Chyba při OCR rozpoznávání: ${error}`);
    return {
      success: false,
      text: '',
      error: `Chyba při OCR rozpoznávání: ${error}`,
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