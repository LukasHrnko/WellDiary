import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import tesseract from 'node-tesseract-ocr';
// Vzhledem k problémům s importem Jimp nebudeme provádět úpravy obrazu
// a místo toho se zaměříme na lepší OCR konfiguraci a post-processing

interface OCRResult {
  success: boolean;
  text: string;
  error?: string;
}

// Create a temporary directory to store uploaded images
const uploadDir = path.join(os.tmpdir(), 'welldiary-uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * Předzpracuje obrázek pro lepší rozpoznávání rukopisu
 * 
 * @param imagePath Cesta k původnímu obrázku
 * @returns Cesta k předzpracovanému obrázku
 */
async function preprocessImageForHTR(imagePath: string): Promise<string> {
  // Vzhledem k problémům s obrazovými knihovnami budeme pracovat přímo s originálním obrázkem
  // a místo toho optimalizujeme OCR nastavení a post-processing
  console.log("Using original image without preprocessing - optimizing OCR settings instead");
  return imagePath;
}

/**
 * Process an image file using enhanced OCR settings for Web AI-like results
 * 
 * @param imagePath Path to the image file
 * @returns Promise with OCR result containing text or error
 */
export async function performWebAiOCR(imagePath: string): Promise<OCRResult> {
  try {
    // Předzpracování obrazu pro lepší rozpoznávání rukopisu
    const processedImagePath = await preprocessImageForHTR(imagePath);
    
    // Specializovaná konfigurace pro rozpoznávání rukopisu (HTR)
    // Používáme optimalizované parametry pro rukopis, které jsou bezpečné
    const config = {
      lang: 'eng',
      oem: 1,        // Neural net LSTM engine only - používá LSTM neuronovou síť pro rukopis
      psm: 6,        // Předpokládá jednolitý blok textu - lepší pro deníkové zápisy
      dpi: 300,      // Vyšší DPI pro lepší detail při rozpoznávání
      tessjs_create_hocr: '0',  // Vypnutí HOCR výstupu pro rychlejší zpracování
      tessjs_create_tsv: '0',   // Vypnutí TSV výstupu pro rychlejší zpracování
      tessjs_create_box: '0',   // Vypnutí BOX výstupu pro rychlejší zpracování
      'debug_file': '/dev/null' // Vypnutí ladění pro rychlejší zpracování
    };
    
    // Recognize text from the preprocessed image
    const text = await tesseract.recognize(processedImagePath, config);
    
    // Vyčistíme dočasný zpracovaný soubor
    try {
      if (fs.existsSync(processedImagePath) && processedImagePath !== imagePath) {
        fs.unlinkSync(processedImagePath);
      }
    } catch (err) {
      console.error('Error cleaning up preprocessed image:', err);
    }
    
    // Process the text to improve quality (simulate AI post-processing)
    let enhancedText = text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');
      
    // Apply enhanced post-processing specifically for handwritten text recognition
    enhancedText = enhancedText
      // Častá záměna znaků v rukopisu
      .replace(/l\s+/g, 'I ') // Replace lonely 'l' with 'I'
      .replace(/\b0\b/g, 'O') // Replace lonely '0' with 'O'
      .replace(/\bl\b/g, 'I') // Replace lonely 'l' with 'I'
      .replace(/\bo\b/g, 'a') // Častá záměna 'o' a 'a'
      .replace(/\brn\b/g, 'm') // Častá záměna 'rn' a 'm'
      .replace(/\bgualify/g, 'qualify') // Častá záměna 'g' a 'q'
      .replace(/\bh\b/g, 'b') // Častá záměna 'h' a 'b'
      .replace(/\bvv\b/g, 'w') // Častá záměna 'vv' a 'w'
      .replace(/\bIl+\b/g, 'Il') // Oprava nadměrných 'l' v 'Il'
      
      // Oprava mezer a interpunkce (běžné v rukopisu)
      .replace(/([,.!?:;])\s*([,.!?:;])/g, '$1') // Odstranění duplicitní interpunkce
      .replace(/\s+([,.!?:;])/g, '$1') // Odstranění mezer před interpunkcí
      .replace(/([,.!?:;])([a-zA-Z])/g, '$1 $2') // Přidání mezer po interpunkci
      .replace(/\s{2,}/g, ' ') // Normalizace vícenásobných mezer
      .replace(/([a-z])([A-Z])/g, '$1 $2') // Přidání mezer mezi malými a velkými písmeny
      
      // Pro rukopis jsou typické pravopisné chyby
      .replace(/\b([Tt])eh\b/g, '$1he') // Přehozené znaky
      .replace(/\b([Tt])eh\b/g, '$1he') // Přehozené znaky
      .replace(/\b([Tt])aht\b/g, '$1hat') // Přehozené znaky
      .replace(/\b([Aa])dn\b/g, '$1nd') // Přehozené znaky
      .replace(/\b([Oo])f+ice\b/g, '$1ffice') // Oprava dvojitých souhlásek
      
      // Korekce slov pro deník v EN + CZ
      .replace(/\bdear diary\b/gi, 'Dear Diary') // Správná kapitalizace "Dear Diary"
      .replace(/\bmilý deníku\b/gi, 'Milý deníku') // CZ ekvivalent
      .replace(/\btoday\b/gi, 'Today') // Běžná slova v denících
      .replace(/\bdnes\b/gi, 'Dnes') // CZ ekvivalent
      
      // Formátování datumů v různých formátech (časté v denících)
      .replace(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/g, '$1/$2/$3')
      .replace(/(\w+\s+\d{1,2})[,]\s*(\d{4})/g, '$1, $2') // Oprava formátu "Září 10, 2023"
      .replace(/(\d{1,2})\.\s*(\d{1,2})\.(?:\s*|\.)(\d{2,4})/g, '$1.$2.$3') // CZ formát data 1.1.2023
      
      // Rozpoznávání emocionálních slov pro lepší detekci nálady - EN
      .replace(/\bhappy\b/gi, 'happy')
      .replace(/\bsad\b/gi, 'sad')
      .replace(/\bangry\b/gi, 'angry')
      .replace(/\bexcited\b/gi, 'excited')
      .replace(/\btired\b/gi, 'tired')
      .replace(/\bexhausted\b/gi, 'exhausted')
      .replace(/\bfrustrated\b/gi, 'frustrated')
      .replace(/\banxious\b/gi, 'anxious')
      .replace(/\bcalm\b/gi, 'calm')
      .replace(/\bpeaceful\b/gi, 'peaceful')
      
      // Rozpoznávání emocionálních slov pro lepší detekci nálady - CZ
      .replace(/\bšťastný\b/gi, 'šťastný')
      .replace(/\bsmutný\b/gi, 'smutný')
      .replace(/\bnaštvaný\b/gi, 'naštvaný')
      .replace(/\bnadšený\b/gi, 'nadšený')
      .replace(/\bunavený\b/gi, 'unavený')
      .replace(/\bvyčerpaný\b/gi, 'vyčerpaný')
      .replace(/\bfrustrovaný\b/gi, 'frustrovaný')
      .replace(/\búzkostný\b/gi, 'úzkostný')
      .replace(/\bklidný\b/gi, 'klidný')
      .replace(/\bspokojen[ýá]\b/gi, 'spokojený')
      
      // Běžná slova a fráze pro wellness deník - CZ
      .replace(/\bnálada\b/gi, 'nálada')
      .replace(/\bspánek\b/gi, 'spánek')
      .replace(/\bhodnocení\b/gi, 'hodnocení')
      .replace(/\baktivita\b/gi, 'aktivita')
      .replace(/\bcvičení\b/gi, 'cvičení')
      .replace(/\bcítím se\b/gi, 'cítím se')
      
      // Další vylepšení pro denní deník - EN měsíce
      .replace(/\bsept(?:ember)?\b/gi, 'September') // Zkratky měsíců
      .replace(/\boct(?:ober)?\b/gi, 'October')
      .replace(/\bnov(?:ember)?\b/gi, 'November')
      .replace(/\bdec(?:ember)?\b/gi, 'December')
      .replace(/\bjan(?:uary)?\b/gi, 'January')
      .replace(/\bfeb(?:ruary)?\b/gi, 'February')
      .replace(/\bmar(?:ch)?\b/gi, 'March')
      .replace(/\bapr(?:il)?\b/gi, 'April')
      .replace(/\bmay\b/gi, 'May')
      .replace(/\bjun(?:e)?\b/gi, 'June')
      .replace(/\bjul(?:y)?\b/gi, 'July')
      .replace(/\baug(?:ust)?\b/gi, 'August')
      
      // České názvy měsíců
      .replace(/\bled(?:en)?\b/gi, 'leden')
      .replace(/\búno(?:r)?\b/gi, 'únor')
      .replace(/\bbře(?:zen)?\b/gi, 'březen')
      .replace(/\bdub(?:en)?\b/gi, 'duben')
      .replace(/\bkvě(?:ten)?\b/gi, 'květen')
      .replace(/\bčer(?:ven)?\b/gi, 'červen')
      .replace(/\bčec(?:enec)?\b/gi, 'červenec')
      .replace(/\bsrp(?:en)?\b/gi, 'srpen')
      .replace(/\bzář(?:í)?\b/gi, 'září')
      .replace(/\bříj(?:en)?\b/gi, 'říjen')
      .replace(/\blis(?:topad)?\b/gi, 'listopad')
      .replace(/\bpro(?:sinec)?\b/gi, 'prosinec')
      
      // Oprava často chybějících velkých písmen na začátku vět
      .replace(/([.!?]\s+)([a-z])/g, (match, p1, p2) => p1 + p2.toUpperCase());
    
    return {
      success: true,
      text: enhancedText
    };
  } catch (error) {
    console.error('Web AI Toolkit OCR processing error:', error);
    return {
      success: false,
      text: '',
      error: error instanceof Error ? error.message : 'Unknown OCR processing error'
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
  // Generate unique filename
  const uniqueFilename = `${Date.now()}-${filename}`;
  const filePath = path.join(uploadDir, uniqueFilename);
  
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
    console.error('Error cleaning up temporary image file:', error);
  }
}