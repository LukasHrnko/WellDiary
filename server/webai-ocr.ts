import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ocr } from 'web-ai-toolkit';

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
 * Process an image file using Web AI Toolkit to extract text.
 * 
 * @param imagePath Path to the image file
 * @returns Promise with OCR result containing text or error
 */
export async function performWebAiOCR(imagePath: string): Promise<OCRResult> {
  try {
    // Read image file as buffer
    const imageBuffer = fs.readFileSync(imagePath);
    
    // Convert buffer to base64 for web-ai-toolkit
    const base64Image = imageBuffer.toString('base64');
    
    // Recognize text from image using web-ai-toolkit's OCR
    const result = await ocr(base64Image);
    
    return {
      success: true,
      text: result ? result.toString() : ''
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