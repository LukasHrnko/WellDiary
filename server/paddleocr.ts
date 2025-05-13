import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createWorker } from 'tesseract.js';

interface OCRResult {
  success: boolean;
  text: string;
  error?: string;
}

// Vytvoření dočasného adresáře pro nahrané obrázky
const uploadDir = path.join(os.tmpdir(), 'welldiary-uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * Zpracuje obrázek pomocí Tesseract.js s optimalizací pro rukopis.
 * 
 * @param imagePath Cesta k souboru obrázku
 * @returns Promise s výsledkem OCR obsahujícím text nebo chybu
 */
export async function performPaddleOCR(imagePath: string): Promise<OCRResult> {
  try {
    // Použijeme Tesseract.js jako alternativu k PaddleJS
    // Ale s nastavením optimalizovaným pro rukopis
    const worker = await createWorker('eng');
    
    // Nastavení parametrů pro lepší rozpoznávání rukopisu - specializované na rozpoznání rukopisu
    await worker.setParameters({
      preserve_interword_spaces: '1',         // Zachovávat mezery mezi slovy
      tessjs_create_hocr: '0',                // Vypnutí HOCR pro rychlejší zpracování
      tessjs_create_tsv: '0',                 // Vypnutí TSV pro rychlejší zpracování
      tessjs_create_box: '0',                 // Vypnutí BOX pro rychlejší zpracování
      tessjs_create_unlv: '0',                // Vypnutí UNLV pro rychlejší zpracování
      tessjs_create_osd: '0',                 // Vypnutí OSD pro rychlejší zpracování
      tessjs_textonly_pdf: '0',               // Vypnutí PDF pro rychlejší zpracování
      tessjs_pdf: '0',                        // Vypnutí PDF pro rychlejší zpracování
      load_system_dawg: '0',                  // Vypnutí slovníku pro lepší rukopis
      language_model_penalty_non_dict_word: '0.5',  // Menší penalizace za slova mimo slovník (pro rukopis)
      language_model_penalty_non_freq_dict_word: '0.5', // Menší penalizace za méně častá slova (pro rukopis)
      // Parametry musí být zadány jako řetězce pro tesseract.js API
      // tessedit_pageseg_mode a tessedit_ocr_engine_mode jsou typově kontrolované, proto je vynecháme
      textord_heavy_nr: '1',                  // Lepší zpracování šumu
      textord_show_blobs: '0',                // Rychlejší zpracování
      textord_noise_debug: '0',               // Vypnutí ladění pro rychlejší zpracování
    });
    
    // Načtení a rozpoznání obrázku
    const result = await worker.recognize(imagePath);
    let text = result.data.text;
    
    // Ukončení workeru
    await worker.terminate();
    
    // Post-processing pro zlepšení kvality rozpoznaného rukopisu
    text = text
      // Základní čištění
      .replace(/\n+/g, '\n')      // Odstranění nadbytečných řádků
      .replace(/\s+/g, ' ')       // Normalizace mezer
      .trim()                     // Oříznutí bílých znaků
      
      // Opravy běžných chyb v rukopisu
      .replace(/l\s+/g, 'I ')     // Osamocené 'l' na 'I'
      .replace(/\b0\b/g, 'O')     // Osamocené '0' na 'O'
      .replace(/\bl\b/g, 'I')     // Osamocené 'l' na 'I'
      .replace(/\bo\b/g, 'a')     // Častá záměna 'o' a 'a'
      .replace(/\brn\b/g, 'm')    // Častá záměna 'rn' a 'm'
      
      // České slovníkové opravy
      .replace(/\bnálada\b/gi, 'nálada')
      .replace(/\bspánek\b/gi, 'spánek')
      .replace(/\bhodnocení\b/gi, 'hodnocení')
      .replace(/\baktivita\b/gi, 'aktivita')
      .replace(/\bcvičení\b/gi, 'cvičení')
      .replace(/\bcítím se\b/gi, 'cítím se')
      
      // České emoce a nálady
      .replace(/\bšťastný\b/gi, 'šťastný')
      .replace(/\bsmutný\b/gi, 'smutný')
      .replace(/\bnaštvaný\b/gi, 'naštvaný')
      .replace(/\bunavený\b/gi, 'unavený')
      
      // Formátování českých datumů
      .replace(/(\d{1,2})\.\s*(\d{1,2})\.(?:\s*|\.)(\d{2,4})/g, '$1.$2.$3');
    
    return {
      success: true,
      text: text
    };
  } catch (error) {
    console.error('PaddleJS OCR processing error:', error);
    return {
      success: false,
      text: '',
      error: error instanceof Error ? error.message : 'Unknown OCR processing error'
    };
  }
}

/**
 * Uloží nahraný obrázek do dočasného umístění
 * 
 * @param buffer Buffer obrázku
 * @param filename Původní název souboru
 * @returns Cesta k uloženému obrázku
 */
export function saveUploadedImage(buffer: Buffer, filename: string): string {
  // Generování unikátního názvu souboru
  const uniqueFilename = `${Date.now()}-${filename}`;
  const filePath = path.join(uploadDir, uniqueFilename);
  
  // Uložení souboru
  fs.writeFileSync(filePath, buffer);
  
  return filePath;
}

/**
 * Vyčistí dočasný soubor obrázku po zpracování
 * 
 * @param filePath Cesta k souboru obrázku, který se má smazat
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