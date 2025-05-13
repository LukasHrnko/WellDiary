/**
 * HTR (Handwritten Text Recognition) modul
 * Specializovaná implementace pro rozpoznávání rukopisu
 * 
 * Tento modul kombinuje TensorFlow.js s Tesseract.js-wasm pro lepší rozpoznávání rukopisu
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as tf from '@tensorflow/tfjs';
import { createWorker } from 'tesseract.js';

// Deklarace pro otsu, protože typové definice nejsou k dispozici
declare module 'otsu' {
  export function otsu(data: Uint8Array | Uint8ClampedArray, width: number, height: number): number;
}
import { readFile } from 'fs/promises';

interface HTRResult {
  success: boolean;
  text: string;
  confidence?: number;
  error?: string;
}

// Create a temporary directory to store uploaded images
const uploadDir = path.join(os.tmpdir(), 'welldiary-uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * Předzpracování obrazu pro HTR
 * Používá TensorFlow.js pro pokročilé předzpracování rukopisu
 * 
 * @param imagePath Cesta k obrázku
 * @returns Cesta k předzpracovanému obrázku
 */
async function preprocessForHTR(imagePath: string): Promise<string> {
  try {
    // Načtení obrázku do bufferu
    const imageBuffer = await readFile(imagePath);
    
    // Decode image using TensorFlow.js
    const tfImage = tf.node.decodeImage(imageBuffer);
    
    // Convert to grayscale
    const grayscale = tf.tidy(() => {
      // Převod na stupně šedi pomocí vážených průměrů barev (0.299 * R + 0.587 * G + 0.114 * B)
      return tfImage.mul(tf.tensor3d([0.299, 0.587, 0.114], [1, 1, 3]))
                  .sum(-1)
                  .expandDims(-1);
    });
    
    // Normalize the image
    const normalized = tf.div(grayscale, tf.scalar(255));
    
    // Enhance contrast using TensorFlow operations
    const enhancedContrast = tf.tidy(() => {
      // Výpočet min a max hodnot v obrázku
      const min = normalized.min();
      const max = normalized.max();
      
      // Normalizace kontrastu
      return normalized.sub(min).div(max.sub(min));
    });
    
    // Binarization for better results with handwriting - convert to purely black and white
    const threshold = tf.scalar(0.7); // Experimentálně zjištěná hodnota pro rukopis
    const binarized = tf.greater(enhancedContrast, threshold).toFloat();
    
    // Vytvoření cesty pro předzpracovaný obrázek
    const processedImagePath = path.join(uploadDir, `htr-processed-${path.basename(imagePath)}`);
    
    // Zápis předzpracovaného obrazu na disk
    const uint8Array = tf.node.encodePng(binarized.mul(tf.scalar(255)).toInt());
    fs.writeFileSync(processedImagePath, uint8Array);
    
    // Uvolnění TensorFlow paměti
    tf.dispose([tfImage, grayscale, normalized, enhancedContrast, binarized]);
    
    console.log('Successfully preprocessed image for HTR');
    return processedImagePath;
  } catch (error) {
    console.error('Error during HTR preprocessing:', error);
    return imagePath; // Při chybě vrátíme původní obraz
  }
}

/**
 * Perform HTR (Handwritten Text Recognition) on an image
 * 
 * @param imagePath Path to the image file
 * @returns Promise with HTR result containing text or error
 */
export async function performHTR(imagePath: string): Promise<HTRResult> {
  try {
    console.log('Starting HTR process on:', imagePath);
    
    // Předzpracování obrazu
    const preprocessedImagePath = await preprocessForHTR(imagePath);
    
    // Nastavení Tesseract.js workeru s optimalizací pro rukopis
    const worker = await createWorker('eng');
    
    // Nastavení parametrů optimalizovaných specificky pro rukopis
    await worker.setParameters({
      tessedit_ocr_engine_mode: '2', // LSTM only
      tessedit_pageseg_mode: '6',    // Assume a single uniform block of text
      tessedit_char_whitelist: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,;:\'"-()!? ', // Povolené znaky
      lstm_use_matrix: '1',          // Použití LSTM matice - lepší pro rukopis
      load_system_dawg: '0',         // Vypnutí slovníku - lepší pro nestandardní text
      language_model_penalty_non_dict_word: '0.5', // Snížení penalizace za slova mimo slovník
    });
    
    // Rozpoznání textu
    console.log('Performing HTR recognition...');
    const result = await worker.recognize(preprocessedImagePath);
    const { text, confidence } = result.data;
    
    // Ukončení workeru
    await worker.terminate();
    
    // Čištění dočasných souborů
    if (preprocessedImagePath !== imagePath) {
      try {
        fs.unlinkSync(preprocessedImagePath);
      } catch (err) {
        console.error('Error cleaning up preprocessed image:', err);
      }
    }
    
    console.log('HTR recognition complete, confidence:', confidence);
    
    // Apply post-processing specific for handwritten text
    const enhancedText = postProcessHandwrittenText(text);
    
    return {
      success: true,
      text: enhancedText,
      confidence: confidence
    };
  } catch (error) {
    console.error('HTR processing error:', error);
    return {
      success: false,
      text: '',
      error: error instanceof Error ? error.message : 'Unknown HTR processing error'
    };
  }
}

/**
 * Post-process recognized handwritten text
 * 
 * @param text Recognized text
 * @returns Enhanced text
 */
function postProcessHandwrittenText(text: string): string {
  // Split into lines and remove empty ones
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // Process each line
  let processedLines = lines.map(line => {
    return line
      // Fix common OCR errors in handwriting
      .replace(/[lI]'m/g, "I'm")
      .replace(/\bwos\b/g, "was")
      .replace(/\bthot\b/g, "that")
      .replace(/\b[lI]\s+/g, "I ")
      .replace(/\b[lI]t\b/g, "It")
      .replace(/\b[lI]f\b/g, "If")
      .replace(/\b[lI]s\b/g, "Is")
      .replace(/\b[lI]n\b/g, "In")
      .replace(/\b[oO]0\b/g, "O")
      .replace(/\b0[oO]\b/g, "O");
  });
  
  // Join the processed lines back together
  let result = processedLines.join('\n');
  
  // Fix sentence capitalization
  result = result.replace(/([.!?]\s+)([a-z])/g, (match, p1, p2) => p1 + p2.toUpperCase());
  
  // Fix common date formats
  result = result.replace(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/g, '$1/$2/$3');
  
  // Fix multi-letter spacing issues (like "t h e")
  result = result.replace(/\b([a-z]) ([a-z]) ([a-z])\b/g, '$1$2$3');
  
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