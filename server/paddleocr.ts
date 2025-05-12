import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Vytvořte type definition pro PaddleJS OCR
interface PaddleOCRResult {
  text: string;
  confidence: number;
  box: number[][];
}

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
 * Zpracuje obrázek pomocí PaddleJS OCR k extrakci textu.
 * 
 * @param imagePath Cesta k souboru obrázku
 * @returns Promise s výsledkem OCR obsahujícím text nebo chybu
 */
export async function performPaddleOCR(imagePath: string): Promise<OCRResult> {
  try {
    // Dynamicky importujte PaddleJS OCR (kvůli problémům s přímým importem)
    const paddleOCR = await import('@paddlejs-models/ocr');
    
    // Načtení obrázku jako buffer
    const imageBuffer = fs.readFileSync(imagePath);
    const imageBlob = new Blob([imageBuffer], { type: 'image/jpeg' });
    
    // Vytvoření instance OCR a inicializace
    // Podle dokumentace PaddleJS OCR je toto správný způsob použití knihovny
    const ocr = new paddleOCR.default();
    await ocr.init();
    
    // Rozpoznání textu z obrázku
    const result = await ocr.recognize(imageBlob);
    
    // Extrakce textu z výsledku
    let textContent = '';
    if (result && Array.isArray(result)) {
      textContent = result.map((item: PaddleOCRResult) => item.text).join('\n');
    }
    
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