/**
 * Utility modul pro extrakci strukturovaných dat z textu
 */

/**
 * Extract structured data from journal text
 * 
 * @param text Journal text content
 * @returns Extracted journal data
 */
export function extractJournalData(text: string) {
  const result = {
    content: text,
    mood: undefined as number | undefined,
    sleep: undefined as number | undefined,
    date: new Date().toISOString().substring(0, 10), // today's date by default
    activities: [] as string[]
  };
  
  // Extract date (looking for date patterns like "Date: 2023-05-12" or "12.5.2023" or "May 12, 2023")
  const datePatterns = [
    /Date:\s*(\d{4}-\d{2}-\d{2})/i,
    /Datum:\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i,
    /(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/,
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i,
    /(Leden|Únor|Březen|Duben|Květen|Červen|Červenec|Srpen|Září|Říjen|Listopad|Prosinec)\s+\d{1,2},?\s+\d{4}/i
  ];
  
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      try {
        // Attempt to parse the date
        const parsedDate = new Date(match[1]);
        if (!isNaN(parsedDate.getTime())) {
          result.date = parsedDate.toISOString().substring(0, 10);
          break;
        }
      } catch (e) {
        // If parsing fails, continue to the next pattern
        continue;
      }
    }
  }
  
  // Extract mood (looking for patterns like "Mood: 8" or "Nálada: 7/10" or "Feeling: 4 out of 10")
  const moodPatterns = [
    /Mood:\s*(\d+(\.\d+)?)\s*\/?\s*10?/i,
    /Nálada:\s*(\d+(\.\d+)?)\s*\/?\s*10?/i,
    /Pocit:\s*(\d+(\.\d+)?)\s*\/?\s*10?/i,
    /Feeling:\s*(\d+(\.\d+)?)\s*(out of)?\s*10?/i,
    /Mood[-: ]+(\d+(\.\d+)?)/i,
    /N[aá]lada[-: ]+(\d+(\.\d+)?)/i
  ];
  
  for (const pattern of moodPatterns) {
    const match = text.match(pattern);
    if (match) {
      const moodValue = parseFloat(match[1]);
      // Normalize to 1-100 scale
      if (moodValue <= 10) {
        result.mood = Math.round(moodValue * 10);
      } else if (moodValue <= 100) {
        result.mood = Math.round(moodValue);
      }
      break;
    }
  }
  
  // Extract sleep (looking for patterns like "Sleep: 7.5 hours" or "Spánek: 6h")
  const sleepPatterns = [
    /Sleep:\s*(\d+(\.\d+)?)\s*h(ours?)?/i,
    /Sp[aá]nek:\s*(\d+(\.\d+)?)\s*h(odin)?/i,
    /Sleep[-: ]+(\d+(\.\d+)?)/i,
    /Sp[aá]nek[-: ]+(\d+(\.\d+)?)/i,
    /Spal[a]? jsem\s*(\d+(\.\d+)?)\s*hodin/i,
    /Slept\s*(\d+(\.\d+)?)\s*hours/i
  ];
  
  for (const pattern of sleepPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.sleep = parseFloat(match[1]);
      break;
    }
  }
  
  // Extract activities (looking for keywords like "run", "gym", "walk", "yoga")
  const activityKeywords = {
    en: ["run", "running", "jog", "gym", "workout", "exercise", "yoga", "fitness", "swimming", "bike", "cycling", "hiking", "walking", "walk"],
    cs: ["běh", "běhat", "běhání", "posilovna", "cvičení", "cvičit", "jóga", "plavání", "kolo", "cyklistika", "túra", "procházka", "chůze"]
  };
  
  const words = text.toLowerCase().split(/\s+/);
  
  for (const word of words) {
    // Check English activities
    for (const keyword of activityKeywords.en) {
      if (word.includes(keyword)) {
        result.activities.push(keyword);
        break;
      }
    }
    
    // Check Czech activities
    for (const keyword of activityKeywords.cs) {
      if (word.includes(keyword)) {
        result.activities.push(keyword);
        break;
      }
    }
  }
  
  // Remove duplicates from activities
  result.activities = Array.from(new Set(result.activities));
  
  return result;
}

/**
 * Clean up text by removing common OCR artifacts
 * 
 * @param text Text to clean
 * @returns Cleaned text
 */
export function cleanText(text: string): string {
  if (!text) return '';
  
  // Remove multiple spaces
  let cleaned = text.replace(/\s+/g, ' ');
  
  // Remove common OCR errors
  cleaned = cleaned.replace(/\|\|/g, 'u');
  cleaned = cleaned.replace(/l1/g, 'h');
  
  // Fix punctuation spacing
  cleaned = cleaned.replace(/\s+([.,;:!?])/g, '$1');
  
  // Normalize line breaks
  cleaned = cleaned.replace(/\r\n/g, '\n');
  
  return cleaned.trim();
}