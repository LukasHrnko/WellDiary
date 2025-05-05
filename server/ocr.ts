import { createWorker } from 'tesseract.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface OCRResult {
  success: boolean;
  text: string;
  error?: string;
}

interface JournalExtraction {
  content: string;
  mood?: number;
  sleep?: number;
  activities: string[];
  date?: string;
}

// Create a temporary directory to store uploaded images
const uploadDir = path.join(os.tmpdir(), 'welldiary-uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * Process an image file using OCR to extract text.
 * 
 * @param imagePath Path to the image file
 * @returns Promise with OCR result containing text or error
 */
export async function performOCR(imagePath: string): Promise<OCRResult> {
  try {
    // Create worker with specified params to ensure proper initialization
    const worker = await createWorker({
      logger: m => console.log(m),
    });
    
    // Recognize text in the image directly without separate language loading
    // In newer versions of tesseract.js, initialize() is handled internally
    const { data } = await worker.recognize(imagePath);
    await worker.terminate();
    
    return {
      success: true,
      text: data.text
    };
  } catch (error) {
    console.error('OCR processing error:', error);
    return {
      success: false,
      text: '',
      error: error instanceof Error ? error.message : 'Unknown OCR processing error'
    };
  }
}

/**
 * Save an uploaded image to a temporary location
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

/**
 * Extract structured information from OCR text
 * 
 * @param text OCR extracted text
 * @returns Structured journal data
 */
export function extractJournalData(text: string): JournalExtraction {
  // Initialize result with empty values
  const result: JournalExtraction = {
    content: text,
    activities: []
  };
  
  // Extract content - remove metadata sections
  let content = text;
  
  // Extract mood rating (look for patterns like "Mood: 7/10" or "Mood Rating: 8")
  const moodPatterns = [
    /mood\s*:?\s*(\d+)(?:\/10)?/i,
    /mood\s*rating\s*:?\s*(\d+)(?:\/10)?/i,
    /feeling\s*:?\s*(\d+)(?:\/10)?/i
  ];
  
  for (const pattern of moodPatterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      const moodValue = parseInt(match[1]);
      // Convert to 0-100 scale
      result.mood = match[0].includes('/10') ? moodValue * 10 : moodValue;
      // Remove matched pattern from content
      content = content.replace(match[0], '');
      break;
    }
  }
  
  // Extract sleep hours (look for patterns like "Sleep: 7.5 hours" or "Slept for 8h")
  const sleepPatterns = [
    /sleep\s*:?\s*([\d.]+)\s*(?:hours|hrs|h)/i,
    /slept\s*(?:for)?\s*([\d.]+)\s*(?:hours|hrs|h)/i,
    /sleep\s*duration\s*:?\s*([\d.]+)\s*(?:hours|hrs|h)/i
  ];
  
  for (const pattern of sleepPatterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      result.sleep = parseFloat(match[1]);
      // Remove matched pattern from content
      content = content.replace(match[0], '');
      break;
    }
  }
  
  // Extract activities (look for lists or sections of activities)
  const activityPatterns = [
    /activities\s*:?(.*?)(?:\n\n|\n[A-Z]|$)/is,
    /did today\s*:?(.*?)(?:\n\n|\n[A-Z]|$)/is,
    /exercise\s*:?(.*?)(?:\n\n|\n[A-Z]|$)/is
  ];
  
  for (const pattern of activityPatterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      // Extract activities from the matched text
      const activitiesText = match[1].trim();
      
      // Split by common separators (commas, bullets, newlines)
      const items = activitiesText
        .split(/[,•\n]/)
        .map(item => item.trim())
        .filter(item => item.length > 0 && item.length < 30); // Filter out empty and too long items
      
      if (items.length > 0) {
        result.activities = items;
        // Remove matched pattern from content
        content = content.replace(match[0], '');
        break;
      }
    }
  }
  
  // Extract date if present
  const datePatterns = [
    /date\s*:?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /(\w+ \d{1,2},? \d{4})/i
  ];
  
  for (const pattern of datePatterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      result.date = match[1];
      // Remove matched pattern from content
      content = content.replace(match[0], '');
      break;
    }
  }
  
  // Clean up content
  result.content = content
    .replace(/^\s+|\s+$/g, '') // Trim start and end
    .replace(/\n{3,}/g, '\n\n'); // Replace multiple line breaks with just two
  
  return result;
}
