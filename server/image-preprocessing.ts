/**
 * Modul pro předzpracování obrázků před OCR
 * 
 * Tento modul poskytuje funkce pro zlepšení kvality obrázků
 * před jejich zpracováním v OCR.
 */

import * as fs from 'fs';
import * as path from 'path';
import { read, MIME_PNG } from 'jimp';

interface PreprocessingResult {
  success: boolean;
  imagePath: string;
  error?: string;
}

/**
 * Zlepší kvalitu obrázku pro OCR zpracování
 * 
 * @param imagePath Cesta k původnímu obrázku
 * @returns Promise s cestou k předzpracovanému obrázku
 */
export async function preprocessImageForOCR(imagePath: string): Promise<PreprocessingResult> {
  console.log(`Předzpracování obrázku pro OCR: ${imagePath}`);
  
  try {
    // Kontrola existence zdrojového souboru
    if (!fs.existsSync(imagePath)) {
      return {
        success: false,
        imagePath,
        error: `Zdrojový soubor neexistuje: ${imagePath}`
      };
    }

    // Načtení obrázku s Jimp
    const image = await read(imagePath);
    
    // Vytvořit novou cestu pro upravenou verzi
    const parsedPath = path.parse(imagePath);
    const processedImagePath = path.join(
      parsedPath.dir,
      `${parsedPath.name}-processed${parsedPath.ext}`
    );
    
    // Série úprav pro zlepšení čitelnosti textu
    image
      // 1. Převod na černobílý (grayscale)
      .grayscale()
      
      // 2. Úprava kontrastu
      .contrast(0.2)
      
      // 3. Zvýšení jasu pro lepší rozlišení textu
      .brightness(0.05)
      
      // 4. Normalizace histogramu (ekvalizace)
      .normalize()
      
      // 5. Odstranění šumu pomocí mírného rozmazání
      .blur(0.5)
      
      // 6. Zvýraznění hran a detailů
      .convolute([
        [-1, -1, -1],
        [-1,  9, -1],
        [-1, -1, -1]
      ])
      
      // 7. Zvýšení kontrastu pro lepší rozlišení mezi textem a pozadím
      .contrast(0.1);
    
    // Uložení výsledného obrázku
    await image.writeAsync(processedImagePath);
    
    console.log(`Obrázek úspěšně předzpracován a uložen jako: ${processedImagePath}`);
    
    return {
      success: true,
      imagePath: processedImagePath
    };
  } catch (error) {
    console.error(`Chyba při předzpracování obrázku: ${error}`);
    
    return {
      success: false,
      imagePath,
      error: `Chyba při předzpracování obrázku: ${error}`
    };
  }
}

/**
 * Vylepšené předzpracování specificky pro rukopis
 * 
 * @param imagePath Cesta k původnímu obrázku
 * @returns Promise s cestou k předzpracovanému obrázku
 */
export async function preprocessHandwrittenImage(imagePath: string): Promise<PreprocessingResult> {
  console.log(`Předzpracování rukopisného obrázku: ${imagePath}`);
  
  try {
    // Kontrola existence zdrojového souboru
    if (!fs.existsSync(imagePath)) {
      return {
        success: false,
        imagePath,
        error: `Zdrojový soubor neexistuje: ${imagePath}`
      };
    }

    // Načtení obrázku s Jimp
    const image = await read(imagePath);
    
    // Vytvořit novou cestu pro upravenou verzi
    const parsedPath = path.parse(imagePath);
    const processedImagePath = path.join(
      parsedPath.dir,
      `${parsedPath.name}-handwritten${parsedPath.ext}`
    );
    
    // Získání rozměrů obrázku
    const width = image.getWidth();
    const height = image.getHeight();
    
    // Nastavení vhodné velikosti pro OCR (mezi 300-400 DPI)
    const scale = 1.5;
    image.resize(Math.round(width * scale), Math.round(height * scale));
    
    // Speciální úpravy pro rukopis:
    image
      // 1. Převod na černobílý (grayscale)
      .grayscale()
      
      // 2. Zvýšení kontrastu pro lepší čitelnost
      .contrast(0.3)
      
      // 3. Automatické nastavení úrovní (auto levels)
      .normalize()
      
      // 4. Thresholding s binárním prahováním pro zvýraznění textu
      .threshold({ max: 180 })
      
      // 5. Další zvýšení kontrastu
      .contrast(0.2);
    
    // Uložení výsledného obrázku
    await image.writeAsync(processedImagePath);
    
    console.log(`Rukopisný obrázek úspěšně předzpracován a uložen jako: ${processedImagePath}`);
    
    return {
      success: true,
      imagePath: processedImagePath
    };
  } catch (error) {
    console.error(`Chyba při předzpracování rukopisného obrázku: ${error}`);
    
    return {
      success: false,
      imagePath,
      error: `Chyba při předzpracování rukopisného obrázku: ${error}`
    };
  }
}

/**
 * Vyčistí dočasné soubory vytvořené během předzpracování
 * 
 * @param imagePath Cesta k předzpracovanému obrázku
 */
export function cleanupProcessedImage(imagePath: string): void {
  try {
    if (fs.existsSync(imagePath) && 
        (imagePath.includes('-processed') || imagePath.includes('-handwritten'))) {
      fs.unlinkSync(imagePath);
      console.log(`Předzpracovaný obrázek odstraněn: ${imagePath}`);
    }
  } catch (error) {
    console.error(`Chyba při čištění předzpracovaného obrázku: ${error}`);
  }
}