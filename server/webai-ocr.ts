import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import tesseract from 'node-tesseract-ocr';

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
 * Process an image file using enhanced OCR settings for Web AI-like results
 * 
 * @param imagePath Path to the image file
 * @returns Promise with OCR result containing text or error
 */
export async function performWebAiOCR(imagePath: string): Promise<OCRResult> {
  try {
    // Instead of using web-ai-toolkit which requires browser APIs,
    // we'll use node-tesseract-ocr with settings optimized for AI-like results
    const config = {
      lang: 'eng',
      oem: 1, // Neural net LSTM engine only
      psm: 6, // Assume a single uniform block of text
      dpi: 300, // Higher DPI for better quality
      load_system_dawg: 0, // Don't load dictionary
      tessedit_create_txt: 1,
      tessedit_char_whitelist: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,?!():;-\'"%$#@&*+= '
    };
    
    // Recognize text from image
    const text = await tesseract.recognize(imagePath, config);
    
    // Process the text to improve quality (simulate AI post-processing)
    const enhancedText = text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');
    
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