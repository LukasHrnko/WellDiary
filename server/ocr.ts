import * as tesseract from 'node-tesseract-ocr';
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

// Configure OCR options
const config = {
  lang: 'eng', // language
  oem: 1, // OCR Engine Mode
  psm: 3, // Page Segmentation Mode
};

/**
 * Process an image file using node-tesseract-ocr to extract text.
 * 
 * @param imagePath Path to the image file
 * @returns Promise with OCR result containing text or error
 */
export async function performOCR(imagePath: string): Promise<OCRResult> {
  try {
    // Recognize text from image
    const text = await tesseract.recognize(imagePath, config);
    
    return {
      success: true,
      text: text
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
  
  // --- VYLEPŠENÁ DETEKCE NÁLADY ---
  // Extract mood rating with enhanced patterns and Czech language support
  
  // Seznam vzorů pro detekci nálady v angličtině i češtině
  const moodPatterns = [
    // Anglické vzory s číselným hodnocením
    /mood\s*:?\s*(\d+)(?:\/(\d+))?/i,
    /mood\s*rating\s*:?\s*(\d+)(?:\/(\d+))?/i,
    /feeling\s*:?\s*(\d+)(?:\/(\d+))?/i,
    /today\s*(?:i\s*)?(?:feel|felt)\s*:?\s*(\d+)(?:\/(\d+))?/i,
    
    // České vzory s číselným hodnocením
    /nálada\s*:?\s*(\d+)(?:\/(\d+))?/i,
    /hodnocení\s*nálady\s*:?\s*(\d+)(?:\/(\d+))?/i,
    /jak\s*se\s*cítím\s*:?\s*(\d+)(?:\/(\d+))?/i,
    /pocit\s*:?\s*(\d+)(?:\/(\d+))?/i,
    
    // Speciální vzor pro typickou notaci "Mood: /100" (zobrazené v zaslané ukázce)
    /mood\s*:?\s*(?:\/|\\|l)?\s*(\d+)/i,
    
    // Vzor pro emotikony
    /mood\s*:?\s*([😀😊🙂😐😕☹️😞😢😡😱]+)/i,
    /nálada\s*:?\s*([😀😊🙂😐😕☹️😞😢😡😱]+)/i
  ];
  
  // Mapa pro převod emotikonů na číselné hodnoty na stupnici 0-100
  const emoticonToMood: {[key: string]: number} = {
    '😀': 100, '😊': 90, '🙂': 80, '😐': 50, '😕': 40, '☹️': 30, '😞': 20, '😢': 10, '😡': 5, '😱': 0
  };
  
  for (const pattern of moodPatterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      let moodValue: number;
      let scale = 10; // Výchozí stupnice
      
      // Zjištění, zda se jedná o emotikon nebo číslo
      if (/\d+/.test(match[1])) {
        // Číselná hodnota
        moodValue = parseInt(match[1]);
        
        // Zjištění stupnice
        if (match[2]) {
          // Explicitní stupnice (např. 8/10)
          scale = parseInt(match[2]);
        } else if (match[0].toLowerCase().includes('/10')) {
          scale = 10;
        } else if (match[0].toLowerCase().includes('/5')) {
          scale = 5;
        } else if (match[0].toLowerCase().includes('/100')) {
          scale = 100;
        } else if (moodValue > 10) {
          // Pokud je hodnota větší než 10, pravděpodobně jde o stupnici 0-100
          scale = 100;
        }
      } else {
        // Emotikon
        moodValue = emoticonToMood[match[1]] || 50; // Výchozí hodnota, pokud emotikon není rozpoznán
        scale = 100; // Emotikony mapujeme přímo na stupnici 0-100
      }
      
      // Převod na stupnici 0-100
      if (scale !== 100) {
        result.mood = Math.round((moodValue / scale) * 100);
      } else {
        result.mood = moodValue;
      }
      
      // Omezení na rozsah 0-100
      result.mood = Math.max(0, Math.min(100, result.mood));
      
      // Remove matched pattern from content
      content = content.replace(match[0], '');
      break;
    }
  }
  
  // Pokud jsme nenašli explicitní hodnocení, zkusíme vyhledat emocionální slova
  if (result.mood === undefined) {
    const positiveWords = ['happy', 'joyful', 'great', 'excellent', 'amazing', 'fantastic', 'wonderful', 'excited',
                          'šťastný', 'radostný', 'skvělý', 'výborný', 'úžasný', 'fantastický', 'nádherný', 'nadšený'];
    const negativeWords = ['sad', 'depressed', 'unhappy', 'miserable', 'terrible', 'awful', 'horrible', 'angry',
                          'smutný', 'depresivní', 'nešťastný', 'mizerný', 'hrozný', 'strašný', 'děsný', 'naštvaný'];
    
    let positiveCount = 0;
    let negativeCount = 0;
    
    // Počítáme výskyt pozitivních a negativních slov
    for (const word of positiveWords) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = content.match(regex);
      if (matches) {
        positiveCount += matches.length;
      }
    }
    
    for (const word of negativeWords) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = content.match(regex);
      if (matches) {
        negativeCount += matches.length;
      }
    }
    
    // Pokud jsme našli emocionální slova, odhadneme náladu
    if (positiveCount > 0 || negativeCount > 0) {
      const total = positiveCount + negativeCount;
      const moodScore = Math.round((positiveCount / total) * 100);
      result.mood = moodScore;
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
    /activities\s*:?(.*?)(?:\n\n|\n[A-Z]|$)/i,
    /did today\s*:?(.*?)(?:\n\n|\n[A-Z]|$)/i,
    /exercise\s*:?(.*?)(?:\n\n|\n[A-Z]|$)/i
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
  
  // --- VYLEPŠENÁ DETEKCE DATUMU ---
  // Extract date with enhanced detection for various formats including day headers
  
  // Mapování anglických měsíců na čísla pro parsování
  const monthNameToNumber: {[key: string]: number} = {
    // Plné anglické názvy měsíců
    'january': 1, 'february': 2, 'march': 3, 'april': 4, 'may': 5, 'june': 6,
    'july': 7, 'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12,
    // Zkratky anglických měsíců  
    'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'jun': 6,
    'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12,
    // České názvy měsíců
    'leden': 1, 'únor': 2, 'březen': 3, 'duben': 4, 'květen': 5, 'červen': 6,
    'červenec': 7, 'srpen': 8, 'září': 9, 'říjen': 10, 'listopad': 11, 'prosinec': 12,
    // Zkratky pro české měsíce
    'led': 1, 'úno': 2, 'bře': 3, 'dub': 4, 'kvě': 5, 'čer': 6,
    'čvc': 7, 'srp': 8, 'zář': 9, 'říj': 10, 'lis': 11, 'pro': 12
  };
  
  // Nejprve zkontrolujeme, jestli první řádek obsahuje datum (typický formát deníku)
  const lines = text.split('\n');
  const headerDate = lines[0]?.match(/([A-Za-z]+day)?\s*,?\s*([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?\s*,?\s*(\d{2,4})/i);
  
  if (headerDate && headerDate[2] && headerDate[3] && headerDate[4]) {
    try {
      const monthName = headerDate[2].toLowerCase();
      const day = parseInt(headerDate[3]);
      let year = parseInt(headerDate[4]);
      
      // Oprava dvouciferného roku
      if (year < 100) {
        year = year < 50 ? 2000 + year : 1900 + year;
      }
      
      if (monthNameToNumber[monthName] && day >= 1 && day <= 31 && year >= 2000 && year <= 2100) {
        const month = monthNameToNumber[monthName];
        result.date = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      }
    } catch (e) {
      // Pokračujeme v hledání, pokud parsování selže
    }
  }
  
  // Pokud jsme nenašli datum v záhlaví, hledáme jinde
  if (!result.date) {
    const datePatterns = [
      // Různé formáty datumů
      /date\s*:?\s*(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/i,
      /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/i,
      /(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+),?\s*(\d{4})/i,
      /([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})/i,
      // Český formát datumu
      /(\d{1,2})\.?\s*(\d{1,2})\.?\s*(\d{4})/i
    ];
    
    for (const pattern of datePatterns) {
      const match = content.match(pattern);
      if (match) {
        try {
          let day, month, year;
          
          if (match[1] && match[2] && match[3]) {
            // Může být buď číselný formát nebo formát s názvem měsíce
            if (isNaN(parseInt(match[2]))) {
              // Formát s názvem měsíce
              day = parseInt(match[1]);
              const monthName = match[2].toLowerCase();
              month = monthNameToNumber[monthName] || 1;
              year = parseInt(match[3]);
            } else {
              // Číselný formát
              const a = parseInt(match[1]);
              const b = parseInt(match[2]);
              year = parseInt(match[3]);
              
              // Logika pro detekci, jestli je první číslo den nebo měsíc
              if (a > 12) {
                // První číslo je den, druhé měsíc
                day = a;
                month = b;
              } else if (b > 12) {
                // První číslo je měsíc, druhé den
                month = a;
                day = b;
              } else {
                // Obě čísla mohou být den nebo měsíc - použijeme evropský formát (den.měsíc.rok)
                day = a;
                month = b;
              }
            }
            
            // Oprava dvouciferného roku
            if (year < 100) {
              year = year < 50 ? 2000 + year : 1900 + year;
            }
            
            if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2000 && year <= 2100) {
              result.date = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
              // Remove matched pattern from content
              content = content.replace(match[0], '');
              break;
            }
          }
        } catch (e) {
          // Ignorovat chyby parsování
          continue;
        }
      }
    }
  }
  
  // Pokud stále nemáme datum, použijeme aktuální
  if (!result.date) {
    const today = new Date();
    result.date = today.toISOString().split('T')[0];
  }
  
  // Clean up content
  result.content = content
    .replace(/^\s+|\s+$/g, '') // Trim start and end
    .replace(/\n{3,}/g, '\n\n'); // Replace multiple line breaks with just two
  
  return result;
}
