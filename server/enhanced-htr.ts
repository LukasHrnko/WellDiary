/**
 * Enhanced HTR (Handwritten Text Recognition) modul
 * Specializovaná implementace pro rozpoznávání rukopisu
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';

interface HTRResult {
  success: boolean;
  text: string;
  confidence?: number;
  error?: string;
}

// Vytvoření složky pro dočasné soubory
const uploadDir = path.join(os.tmpdir(), 'welldiary-uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * Pokročilé předzpracování obrazu pro rukopisný text
 * 
 * @param imagePath Cesta k obrázku
 * @returns Cesta k předzpracovanému obrázku
 */
async function enhancedPreprocessing(imagePath: string): Promise<string> {
  try {
    console.log('Starting enhanced preprocessing for HTR');
    
    // Pokročilé předzpracování obrazu pomocí sharp
    const processedImagePath = path.join(uploadDir, `enhanced-htr-${Date.now()}-${path.basename(imagePath)}`);
    
    await sharp(imagePath)
      // Převod na odstíny šedi
      .grayscale()
      // Zvýšení kontrastu
      .linear(1.5, -0.2)
      // Ostření pro zvýraznění tahů
      .sharpen(1.5, 0.7, 0.5)
      // Binární prahování pro separaci textu od pozadí
      .threshold(135)
      // Zvětšení obrazu pro lepší rozpoznávání detailů
      .resize({ width: 2000, fit: 'contain', withoutEnlargement: false })
      // Uložení do formátu PNG pro bezztrátovou kompresi
      .toFile(processedImagePath);
    
    console.log('Enhanced preprocessing complete');
    return processedImagePath;
  } catch (error) {
    console.error('Error during enhanced preprocessing:', error);
    return imagePath; // Při chybě vrátíme původní obraz
  }
}

/**
 * Perform Enhanced HTR (Handwritten Text Recognition) on an image
 * 
 * @param imagePath Path to the image file
 * @returns Promise with HTR result containing text or error
 */
export async function performEnhancedHTR(imagePath: string): Promise<HTRResult> {
  try {
    console.log('Starting enhanced HTR process on:', imagePath);
    
    // Pokročilé předzpracování obrazu
    const processedImagePath = await enhancedPreprocessing(imagePath);
    
    // Nastavení tesseractu s optimálními parametry pro rukopis
    const worker = await createWorker('eng');
    
    // Specifické nastavení pro rukopis
    await worker.setParameters({
      // LSTM OCR engine - lepší pro rukopis
      tessedit_ocr_engine_mode: '2',
      
      // Segmentace stránky
      // hodnota '6' odpovídá PSM.SINGLE_BLOCK, ale použitím stringové hodnoty obejdeme typovou kontrolu
      tessedit_pageseg_mode: '6',
      
      // Specifický whitelist znaků pro deníkové záznamy
      tessedit_char_whitelist: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,;:\'"-()!?/$ ',
      
      // Vypnutí slovníku pro lepší rozpoznání nestandardního textu
      load_system_dawg: '0',
      
      // Snížení penalizace za slova mimo slovník
      language_model_penalty_non_dict_word: '0.15',
    });
    
    // Rozpoznávání textu
    console.log('Performing recognition...');
    const result = await worker.recognize(processedImagePath);
    
    // Ukončení workeru
    await worker.terminate();
    
    // Čištění dočasných souborů
    if (processedImagePath !== imagePath) {
      try { fs.unlinkSync(processedImagePath); } catch (e) {}
    }
    
    console.log('Enhanced HTR complete, confidence:', result.data.confidence);
    
    // Dodatečné post-zpracování textu
    const enhancedText = postprocessHandwrittenText(result.data.text);
    
    return {
      success: true,
      text: enhancedText,
      confidence: result.data.confidence
    };
  } catch (error) {
    console.error('Enhanced HTR processing error:', error);
    return {
      success: false,
      text: '',
      error: error instanceof Error ? error.message : 'Unknown enhanced HTR processing error'
    };
  }
}

/**
 * Pokročilý postprocessing rozpoznaného textu pro zvýšení kvality
 * 
 * @param text Rozpoznaný text z OCR
 * @returns Vylepšený text
 */
function postprocessHandwrittenText(text: string): string {
  // Rozdělit text na řádky
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // Čištění a korekce textu
  const processedLines = lines.map(line => {
    return line
      // Oprava společných OCR chyb v rukopisu
      .replace(/[lI]'m/g, "I'm")
      .replace(/\bwos\b/g, "was")
      .replace(/\bthot\b/g, "that")
      .replace(/\b[lI]\s+/g, "I ")
      .replace(/\b[lI]t\b/g, "It")
      .replace(/\b[lI]f\b/g, "If")
      .replace(/\b[lI]s\b/g, "Is")
      .replace(/\b[lI]n\b/g, "In")
      .replace(/\b[oO]0\b/g, "O")
      .replace(/\b0[oO]\b/g, "O")
      .replace(/\btne\b/g, "the")
      .replace(/\bTne\b/g, "The")
      
      // Oprava čísel a datumů
      .replace(/(\d)l(\d)/g, "$11$2") // 'l' místo '1' v číslech
      .replace(/(\d)[oO](\d)/g, "$10$2") // 'o' místo '0' v číslech
      
      // Oprava běžných zkratek
      .replace(/\bb\/c\b/g, "because")
      .replace(/\bw\/\b/g, "with")
      .replace(/\bw\/o\b/g, "without")
      
      // Oprava interpunkce
      .replace(/,,/g, ",")
      .replace(/\.\./g, ".")
      .replace(/\,\./g, ".")
      .replace(/\s+\./g, ".")
      .replace(/\s+\,/g, ",")
      .replace(/\s+\!/g, "!")
      .replace(/\s+\?/g, "?")
      
      // Oprava mezer
      .replace(/\s+/g, " ")
      .trim();
  });
  
  // Spojení řádků
  let result = processedLines.join('\n');
  
  // Oprava kapitalizace (začátek věty velkým písmenem)
  result = result.replace(/([.!?]\s+)([a-z])/g, (match, p1, p2) => p1 + p2.toUpperCase());
  
  // Oprava formátu data
  result = result.replace(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/g, '$1/$2/$3');
  
  // Oprava problému s oddělením písmen
  result = result.replace(/\b([a-z]) ([a-z]) ([a-z])\b/g, '$1$2$3');
  
  // Specifické opravy pro české texty
  result = result
    .replace(/\bcasem\b/g, "časem")
    .replace(/\btezky\b/g, "těžký")
    .replace(/\bpouzit\b/g, "použít")
    .replace(/\bmuj\b/g, "můj")
    .replace(/\btve\b/g, "tvé")
    .replace(/\bprace\b/g, "práce")
    .replace(/\bskola\b/g, "škola")
    .replace(/\bskoly\b/g, "školy")
    .replace(/\bjeste\b/g, "ještě")
    .replace(/\bpritel\b/g, "přítel")
    .replace(/\bpritelkyne\b/g, "přítelkyně")
    .replace(/\bprijemny\b/g, "příjemný");
  
  return result;
}

/**
 * Save uploaded image to a temporary location
 * 
 * @param buffer Image buffer
 * @param filename Original filename
 * @returns Path to the saved image
 */
export function saveUploadedImage(buffer: Buffer, filename: string): string {
  // Generate a unique filename
  const uniqueFilename = `${Date.now()}-${filename}`;
  const filePath = path.join(uploadDir, uniqueFilename);
  
  // Save the file
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
    console.error('Error cleaning up temporary image file:', error);
  }
}