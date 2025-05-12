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
    
    // Nastavení parametrů pro lepší rozpoznávání rukopisu
    await worker.setParameters({
      tessedit_ocr_engine_mode: 2, // LSTM pouze
      tessedit_pageseg_mode: 6,    // Režim segmentace pro jednotné bloky textu
      preserve_interword_spaces: '1',
      tessjs_create_hocr: '0',
      tessjs_create_tsv: '0'
    });
    
    // Načtení a rozpoznání obrázku
    const result = await worker.recognize(imagePath);
    const text = result.data.text;
    
    // Ukončení workeru
    await worker.terminate();
    
    
    return {
      success: true,
      text: textContent
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