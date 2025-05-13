/**
 * Modul pro rozpoznávání rukopisu pomocí handwriting.js
 * 
 * Specializovaná implementace zaměřená výhradně na rukopisný text
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import sharp from 'sharp';
import { createCanvas, loadImage, Image } from 'canvas';
// @ts-ignore
import * as handwriting from 'handwriting.js';

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
 * Předzpracování obrazu optimalizované pro handwriting.js
 * 
 * @param imagePath Cesta k obrázku
 * @returns Cesta k předzpracovanému obrázku
 */
async function preprocessForHandwritingJS(imagePath: string): Promise<string> {
  try {
    console.log('Starting preprocessing for handwriting.js');
    
    // Cesta k výstupnímu souboru
    const processedImagePath = path.join(uploadDir, `hw-processed-${Date.now()}-${path.basename(imagePath)}`);
    
    // Optimální předzpracování pro handwriting.js
    await sharp(imagePath)
      // Převod na odstíny šedi
      .grayscale()
      // Normalizace histogramu
      .normalize()
      // Zvýšení kontrastu pro čitelnost tahů
      .linear(1.5, -0.15)
      // Odstraňování šumu (mediánový filtr)
      .median(3)
      // Ostření pro lepší zvýraznění tahů
      .sharpen(1.8, 1.0, 0.8)
      // Změna velikosti (400x400 pixel je dobrý rozměr pro handwriting.js)
      .resize(400, 400, {
        fit: 'inside',
        withoutEnlargement: false
      })
      // Binarizace (prahování) pro černobílý obraz
      .threshold(130)
      // Uložíme jako PNG pro bezztrátovou kvalitu
      .toFile(processedImagePath);
    
    console.log('Preprocessing for handwriting.js complete');
    return processedImagePath;
  } catch (error) {
    console.error('Error during preprocessing for handwriting.js:', error);
    // Při chybě vrátíme původní soubor
    return imagePath;
  }
}

/**
 * Extrahuje jednotlivé znaky (segmentace) z obrázku
 * 
 * @param imagePath Cesta k předzpracovanému obrázku
 * @returns Pole URL k segmentovaným znakům
 */
async function segmentCharactersFromImage(imagePath: string): Promise<string[]> {
  try {
    console.log('Starting character segmentation');
    
    // Načteme obrázek pro zpracování
    const image = await loadImage(imagePath);
    
    // Vytvoříme canvas stejné velikosti jako obrázek
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    
    // Vykreslíme obrázek na canvas
    ctx.drawImage(image, 0, 0);
    
    // Získáme černobílá data obrázku
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Převedeme na čistě černobílá data (pro segmentaci)
    for (let i = 0; i < data.length; i += 4) {
      // Získáme průměrnou hodnotu pixelu
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      // Nastavíme na černou nebo bílou
      const color = avg > 128 ? 255 : 0;
      data[i] = data[i + 1] = data[i + 2] = color;
      data[i + 3] = 255; // Alfa je vždy 100%
    }
    
    // Vložíme zpět černobílá data
    ctx.putImageData(imageData, 0, 0);
    
    // Nyní použijeme techniku segmentace znaků
    // Zde používáme handwriting.js pro segmentaci - zavoláme API knihovny
    const segments = handwriting.segment(canvas);
    
    // Pole pro URL segmentovaných znaků
    const segmentUrls: string[] = [];
    
    // Pro každý segment vytvoříme samostatný obrázek
    for (let i = 0; i < segments.length; i++) {
      const segmentCanvas = createCanvas(segments[i].width, segments[i].height);
      const segmentCtx = segmentCanvas.getContext('2d');
      
      // Extrahujeme část původního obrázku
      const segmentData = ctx.getImageData(
        segments[i].x, segments[i].y, 
        segments[i].width, segments[i].height
      );
      
      // Vložíme do nového canvasu
      segmentCtx.putImageData(segmentData, 0, 0);
      
      // Uložíme jako soubor
      const segmentPath = path.join(uploadDir, `segment-${Date.now()}-${i}.png`);
      const out = fs.createWriteStream(segmentPath);
      const stream = segmentCanvas.createPNGStream();
      stream.pipe(out);
      
      // Po zápisu přidáme URL do pole
      await new Promise<void>((resolve) => {
        out.on('finish', () => {
          segmentUrls.push(segmentPath);
          resolve();
        });
      });
    }
    
    console.log(`Segmented ${segmentUrls.length} characters`);
    return segmentUrls;
  } catch (error) {
    console.error('Error during character segmentation:', error);
    return [];
  }
}

/**
 * Rozpozná znaky pomocí handwriting.js
 * 
 * @param segmentUrls Pole URL k segmentovaným znakům
 * @returns Rozpoznaný text
 */
async function recognizeCharacters(segmentUrls: string[]): Promise<string> {
  try {
    console.log('Starting character recognition');
    
    // Výsledný text
    let text = '';
    
    // Pro každý segment rozpoznáme znak
    for (const segmentUrl of segmentUrls) {
      const image = await loadImage(segmentUrl);
      const canvas = createCanvas(image.width, image.height);
      const ctx = canvas.getContext('2d');
      
      ctx.drawImage(image, 0, 0);
      
      // Využití handwriting.js pro rozpoznání znaku
      const recognizedChar = await handwriting.recognize(canvas);
      
      // Přidáme rozpoznaný znak do výsledného textu
      if (recognizedChar && recognizedChar.length > 0) {
        text += recognizedChar[0];
      } else {
        // Pokud nebyl rozpoznán, přidáme mezeru
        text += ' ';
      }
      
      // Vyčistíme dočasný soubor
      try { fs.unlinkSync(segmentUrl); } catch (e) {}
    }
    
    // Postprocessing - odstranění zbytečných mezer
    text = text.replace(/\s+/g, ' ').trim();
    
    console.log('Character recognition complete');
    return text;
  } catch (error) {
    console.error('Error during character recognition:', error);
    return '';
  }
}

/**
 * Speciální postprocessing pro handwriting.js
 * 
 * @param text Rozpoznaný text
 * @returns Upravený text
 */
function postprocessHandwritingResult(text: string): string {
  // Odstranění duplicitních mezer
  text = text.replace(/\s+/g, ' ').trim();
  
  // Korekce běžných substitucí
  text = text
    .replace(/0/g, 'o')
    .replace(/1/g, 'l')
    .replace(/5/g, 's')
    .replace(/8/g, 'B')
    .replace(/\$/g, 'S');
  
  // Korekce kontextu - typické fráze v deníkových záznamech
  text = text
    .replace(/tod.y/i, 'today')
    .replace(/d.ar/i, 'dear')
    .replace(/d.ary/i, 'diary')
    .replace(/w.nt/i, 'went')
    .replace(/sch.ol/i, 'school');
  
  // Vylepšení interpunkce
  text = text
    .replace(/\,\./g, '.')
    .replace(/\s+\./g, '.')
    .replace(/\s+\,/g, ',');
  
  // Oprava kapitalizace na začátku vět
  text = text.replace(/([.!?]\s+)([a-z])/g, (match, p1, p2) => p1 + p2.toUpperCase());
  
  // Zajistit, že první písmeno je velké
  if (text.length > 0) {
    text = text.charAt(0).toUpperCase() + text.slice(1);
  }
  
  return text;
}

/**
 * Provede rozpoznávání rukopisu pomocí handwriting.js
 * 
 * @param imagePath Cesta k obrázku
 * @returns Výsledek rozpoznávání rukopisu
 */
export async function performHandwritingRecognition(imagePath: string): Promise<HTRResult> {
  try {
    console.log('Starting handwriting recognition process on:', imagePath);
    
    // Předzpracování obrázku
    const processedImagePath = await preprocessForHandwritingJS(imagePath);
    
    // Segmentace znaků
    const segmentUrls = await segmentCharactersFromImage(processedImagePath);
    
    if (segmentUrls.length === 0) {
      console.error('Failed to segment characters');
      return {
        success: false,
        text: '',
        error: 'Failed to segment characters'
      };
    }
    
    // Rozpoznání znaků
    const recognizedText = await recognizeCharacters(segmentUrls);
    
    // Postprocessing výsledku
    const enhancedText = postprocessHandwritingResult(recognizedText);
    
    // Vyčištění dočasných souborů
    if (processedImagePath !== imagePath) {
      try { fs.unlinkSync(processedImagePath); } catch (e) {}
    }
    
    console.log('Handwriting recognition complete');
    
    return {
      success: true,
      text: enhancedText,
      confidence: 75 // Přibližná důvěryhodnost výsledku
    };
  } catch (error) {
    console.error('Handwriting recognition error:', error);
    return {
      success: false,
      text: '',
      error: error instanceof Error ? error.message : 'Unknown error during handwriting recognition'
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