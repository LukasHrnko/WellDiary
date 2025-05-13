/**
 * Vylepšený Tesseract OCR modul
 * 
 * Tento modul používá Tesseract.js s pokročilým předzpracováním obrázků
 * pro zlepšení rozpoznávání ručně psaného textu.
 */

import * as fs from 'fs';
import * as path from 'path';
import Jimp from 'jimp/es';
import { createWorker } from 'tesseract.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

interface OCRResult {
  success: boolean;
  text: string;
  confidence?: number;
  error?: string;
  execution_time?: number;
}

/**
 * Provede rozpoznávání textu s vylepšeným předzpracováním
 * 
 * @param imagePath Cesta k obrázku
 * @param language Kód jazyka (výchozí: 'eng')
 * @returns Promise s výsledkem OCR
 */
export async function performTrOCR(imagePath: string, language: string = 'eng'): Promise<OCRResult> {
  console.log(`Provádím vylepšené OCR rozpoznávání: ${imagePath}`);
  
  const startTime = Date.now();
  
  try {
    // Kontrola existence souboru
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Soubor neexistuje: ${imagePath}`);
    }
    
    // Předzpracování obrázku
    const processedImagePath = await enhancedPreprocessing(imagePath);
    
    // Vícenásobné OCR s různými nastaveními
    const results = await Promise.all([
      recognizeWithTesseract(processedImagePath, language, { psm: 6 }),  // Předpokládá jeden blok textu
      recognizeWithTesseract(processedImagePath, language, { psm: 11, oem: 1 }),  // Průběžné rozpoznávání bez předpokladů, LSTM
      recognizeWithTesseract(processedImagePath, language, { psm: 12, oem: 3 })   // Řádkově orientovaný text, LSTM + legacy
    ]);
    
    // Vyber nejlepší výsledek podle konfidence
    const bestResult = results.reduce((best, current) => 
      (current.confidence > (best.confidence || 0)) ? current : best, results[0]);
    
    console.log(`Vylepšené OCR dokončeno za ${((Date.now() - startTime) / 1000).toFixed(2)} sekund`);
    console.log(`Rozpoznaný text: ${bestResult.text}`);
    
    // Vyčištění dočasných souborů
    try {
      fs.unlinkSync(processedImagePath);
    } catch (err) {
      console.warn(`Nepodařilo se smazat dočasný soubor: ${processedImagePath}`);
    }
    
    // Postprocessing textu
    const enhancedText = postprocessText(bestResult.text);
    
    return {
      success: true,
      text: enhancedText,
      confidence: bestResult.confidence,
      execution_time: (Date.now() - startTime) / 1000
    };
  } catch (error) {
    console.error(`Chyba při vylepšeném OCR: ${error}`);
    return {
      success: false,
      text: '',
      error: `Chyba při vylepšeném OCR: ${error}`,
      execution_time: (Date.now() - startTime) / 1000
    };
  }
}

/**
 * Provede rozpoznávání textu pomocí Tesseract s definovaným nastavením
 * 
 * @param imagePath Cesta k obrázku
 * @param language Kód jazyka
 * @param options Nastavení Tesseract (PSM a OEM)
 * @returns Výsledek rozpoznávání
 */
async function recognizeWithTesseract(
  imagePath: string, 
  language: string, 
  options: { psm: number, oem?: number }
): Promise<{ text: string, confidence: number }> {
  try {
    const worker = await createWorker(language);
    
    // Nastav parametry rozpoznávání
    await worker.setParameters({
      tessedit_pageseg_mode: String(options.psm),
      ...(options.oem ? { tessedit_ocr_engine_mode: String(options.oem) } : {})
    });
    
    // Spusť rozpoznávání
    const result = await worker.recognize(imagePath);
    
    // Ukonči worker
    await worker.terminate();
    
    return {
      text: result.data.text,
      confidence: result.data.confidence
    };
  } catch (error) {
    console.error(`Chyba při Tesseract OCR s PSM=${options.psm}: ${error}`);
    return {
      text: '',
      confidence: 0
    };
  }
}

/**
 * Vylepšené předzpracování obrázku pro lepší výsledky OCR
 * 
 * @param imagePath Cesta k obrázku
 * @returns Cesta k předzpracovanému obrázku
 */
async function enhancedPreprocessing(imagePath: string): Promise<string> {
  const tmpPath = path.join(path.dirname(imagePath), `enhanced-${path.basename(imagePath)}`);
  
  try {
    // Načtení obrázku pomocí Jimp
    const image = await Jimp.read(imagePath);
    
    // Série úprav pro zlepšení čitelnosti
    image
      // Převod na stupně šedi
      .grayscale()
      // Úprava kontrastu
      .contrast(0.5)
      // Zostření
      .convolute([
        [-1, -1, -1],
        [-1,  9, -1],
        [-1, -1, -1]
      ])
      // Prahování pro čistší text
      .threshold({ max: 180 });
    
    // Uložení upraveného obrázku
    await image.writeAsync(tmpPath);
    
    return tmpPath;
  } catch (error) {
    console.error(`Chyba při předzpracování obrázku: ${error}`);
    // V případě selhání vrátíme původní obrázek
    return imagePath;
  }
}

/**
 * Postprocessing OCR textu pro zlepšení kvality
 * 
 * @param text Rozpoznaný text
 * @returns Vylepšený text
 */
function postprocessText(text: string): string {
  return text
    // Odstranění nadbytečných mezer
    .replace(/\s+/g, ' ')
    // Odstranění mezer na začátku a konci
    .trim()
    // Oprava běžných chyb rozpoznávání
    .replace(/[|]l/g, 'I')
    .replace(/[0O](?=\d)/g, '0')  // O -> 0 pokud následuje číslo
    .replace(/(?<=\d)[0O]/g, '0')  // O -> 0 pokud předchází číslo
    .replace(/l(?=[a-z])/g, 'i')  // l -> i pokud následuje malé písmeno
    .replace(/(?<=[a-z])l/g, 'i')  // l -> i pokud předchází malé písmeno
    // Korekce čárek a teček
    .replace(/,(?!\s)/g, ', ')
    .replace(/\.(?!\s|$)/g, '. ');
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