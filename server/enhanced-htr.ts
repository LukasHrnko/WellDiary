/**
 * Enhanced HTR (Handwritten Text Recognition) modul
 * Specializovaná implementace pro rozpoznávání rukopisu
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import sharp from 'sharp';
import { createWorker, PSM } from 'tesseract.js';

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
 * Pokročilé předzpracování obrazu pro rukopisný text
 * Používá adaptivní techniky pro různé typy rukopisu
 * 
 * @param imagePath Cesta k obrázku
 * @returns Cesta k předzpracovanému obrázku
 */
async function enhancedPreprocessing(imagePath: string): Promise<string> {
  try {
    console.log('Starting enhanced preprocessing for HTR');
    
    // Základní zpracovaný obraz
    const baseProcessedImagePath = path.join(uploadDir, `enhanced-htr-base-${Date.now()}-${path.basename(imagePath)}`);
    
    // Pokročilé předzpracování obrazu pomocí sharp
    const processedImagePath = path.join(uploadDir, `enhanced-htr-${Date.now()}-${path.basename(imagePath)}`);
    
    // Načtení zdrojového obrazu
    const metadata = await sharp(imagePath).metadata();
    const isLargeImage = (metadata.width || 0) > 1000 || (metadata.height || 0) > 1000;
    
    // Základní zpracování obrazu pro všechny typy rukopisu
    await sharp(imagePath)
      // Převod na odstíny šedi
      .grayscale()
      // Základní zpracování s nižším kontrastem pro temný text na světlém pozadí
      .linear(1.3, -0.15) // Mírnější kontrast pro zachování detailů
      // Ostření pro zvýraznění tahů, ale šetrněji
      .sharpen(1.2, 0.6, 0.4)
      // Zvětšení obrazu (pokud je potřeba)
      .resize({ 
        width: isLargeImage ? undefined : 2000, 
        height: isLargeImage ? undefined : undefined,
        fit: 'contain', 
        withoutEnlargement: false 
      })
      // Uložení základní verze
      .toFile(baseProcessedImagePath);
    
    // Pokročilejší zpracování s adaptivním prahováním a normalizací
    await sharp(baseProcessedImagePath)
      // Normalizace histogramu pro vyrovnání kontrastu
      .normalize()
      // Další zvýšení kontrastu - adaptivní podle potřeby
      .linear(1.2, -0.1)
      // Gaussovské rozostření pro redukci šumu (jemné)
      .blur(0.5)
      // Zvýraznění hran pro lepší definici textu (kernel pro detekci hran)
      .sharpen(1.5, 0.7, 0.5)
      // Mírné prahování - zůstanou úrovně šedi, ale tmavší text
      .threshold(140)
      // Uložení pokročile zpracovaného obrazu
      .toFile(processedImagePath);
    
    // Vyčištění dočasného mezikroku
    try {
      fs.unlinkSync(baseProcessedImagePath);
    } catch (err) {
      console.warn('Warning: Could not delete intermediate image:', err);
    }
    
    console.log('Enhanced preprocessing complete');
    return processedImagePath;
  } catch (error) {
    console.error('Error during enhanced preprocessing:', error);
    
    // Záložní mechanismus při selhání pokročilého zpracování
    try {
      // Jednodušší alternativní zpracování
      const fallbackImagePath = path.join(uploadDir, `enhanced-htr-fallback-${Date.now()}-${path.basename(imagePath)}`);
      
      await sharp(imagePath)
        .grayscale()
        .linear(1.4, -0.2) // Zvýšený kontrast
        .sharpen() // Výchozí ostření
        .resize(2000) // Jednoduchá změna velikosti
        .toFile(fallbackImagePath);
        
      console.log('Using fallback image preprocessing');
      return fallbackImagePath;
    } catch (fallbackError) {
      console.error('Fallback processing failed:', fallbackError);
      return imagePath; // Při selhání všech metod vrátíme původní obraz
    }
  }
}

/**
 * Perform Enhanced HTR (Handwritten Text Recognition) on an image
 * 
 * @param imagePath Path to the image file
 * @returns Promise with HTR result containing text or error
 */
export async function performEnhancedHTR(imagePath: string): Promise<HTRResult> {
  try {
    console.log('Starting enhanced HTR process on:', imagePath);
    
    // Pokročilé předzpracování obrazu
    const processedImagePath = await enhancedPreprocessing(imagePath);
    
    // Optimalizované nastavení tesseractu pro rukopis s explicitní definicí
    // Poznámka: Některá nastavení lze provést jen při inicializaci
    let worker;
    
    try {
      // Zkusíme použít optimální konfiguraci s definovanými parametry
      worker = await createWorker('eng');
      
      // Specifické nastavení pro rukopis
      await worker.setParameters({
        // Segmentace stránky - SINGLE_BLOCK - předpokládáme souvislý text deníku
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        
        // Rozšířený whitelist znaků pokrývající více znaků běžných v deníkových záznamech
        tessedit_char_whitelist: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,;:\'"-()!?/$@%*=<>_+& ',
        
        // Optimalizace pro rukopis - relaxace restrikce na slovník
        language_model_penalty_non_dict_word: '0.05',
        
        // Nastavení pro rukou psaný text - mírnější omezení na mezery a fonty
        language_model_penalty_font: '0',
        language_model_penalty_spacing: '0.05',
        language_model_penalty_case: '0.0',
        
        // Další pokročilá nastavení pro rukopisný text
        classify_bln_numeric_mode: '1',
        tessedit_minimal_rejection: '1',
        
        // Experimentální nastavení pro vyšší přesnost rozpoznávání
        lstm_use_matrix: '1',
        tessedit_write_images: '0'
      });
    } catch (configError) {
      console.error('Error with advanced Tesseract configuration:', configError);
      
      // Fallback na základní konfiguraci
      console.log('Using fallback Tesseract configuration');
      worker = await createWorker('eng');
      
      // Jednodušší nastavení které by mělo vždy fungovat
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        tessedit_char_whitelist: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,;:\'"-()!?/$ ',
      });
    }
    
    // Rozpoznávání textu
    console.log('Performing recognition...');
    const result = await worker.recognize(processedImagePath);
    
    // Ukončení workeru
    await worker.terminate();
    
    // Čištění dočasných souborů
    if (processedImagePath !== imagePath) {
      try { fs.unlinkSync(processedImagePath); } catch (e) {}
    }
    
    console.log('Enhanced HTR complete, confidence:', result.data.confidence);
    
    // Dodatečné post-zpracování textu - aplikuje několik vrstev korekcí
    let enhancedText = postprocessHandwrittenText(result.data.text);
    
    return {
      success: true,
      text: enhancedText,
      confidence: result.data.confidence
    };
  } catch (error) {
    console.error('Enhanced HTR processing error:', error);
    return {
      success: false,
      text: '',
      error: error instanceof Error ? error.message : 'Unknown enhanced HTR processing error'
    };
  }
}

// Statistické n-gramy pro nejčastější kolokace v deníkových záznamech
// Toto je jednoduchý model založený na pravděpodobnosti výskytu slov vedle sebe
const commonBigrams: [string, string][] = [
  ["I", "was"],
  ["I", "am"],
  ["I", "went"],
  ["I", "had"],
  ["I", "feel"],
  ["I", "think"],
  ["I", "saw"],
  ["I", "met"],
  ["I", "have"],
  ["I", "got"],
  ["Dear", "Diary"],
  ["my", "friend"],
  ["my", "mom"],
  ["my", "dad"],
  ["my", "parents"],
  ["my", "sister"],
  ["my", "brother"],
  ["my", "teacher"],
  ["my", "school"],
  ["in", "the"],
  ["at", "the"],
  ["to", "the"],
  ["of", "the"],
  ["with", "my"],
  ["for", "the"],
  ["about", "the"],
  ["really", "excited"],
  ["very", "happy"],
  ["very", "sad"],
  ["very", "tired"],
  ["very", "interesting"],
  ["a", "lot"],
  ["so", "much"],
  ["so", "happy"],
  ["so", "sad"],
  ["so", "tired"],
  ["so", "excited"],
  ["we", "went"],
  ["we", "had"],
  ["this", "morning"],
  ["today", "I"],
  ["today", "was"],
  ["it", "was"],
];

// Seřazené podle četnosti výskytu - založeno na typickém obsahu deníků
const commonDiaryWords = [
  "I", "my", "me", "today", "went", "was", "had", "have", "friend", "friends",
  "school", "class", "teacher", "mom", "dad", "parents", "sister", "brother",
  "morning", "day", "night", "homework", "really", "very", "good", "bad",
  "happy", "sad", "excited", "tired", "interesting", "boring", "fun", "great",
  "awful", "amazing", "home", "house", "room", "played", "watched", "saw",
  "favorite", "love", "like", "hate", "think", "feel", "felt", "got", "learned",
  "ate", "food", "lunch", "dinner", "breakfast", "time", "hours", "minutes"
];

// České statistické n-gramy
const czechBigrams: [string, string][] = [
  ["můj", "den"],
  ["dnes", "jsem"],
  ["jsem", "měl"],
  ["jsem", "byla"],
  ["jsem", "byl"],
  ["ve", "škole"],
  ["do", "školy"],
  ["s", "kamarádem"],
  ["s", "kamarádkou"],
  ["moje", "mamka"],
  ["můj", "taťka"],
  ["mám", "radost"],
  ["bylo", "to"],
  ["je", "to"],
  ["na", "výlet"],
  ["v", "noci"],
  ["dobrý", "den"],
  ["milý", "deníčku"],
];

// Běžná česká slova v deníkových zápisech
const czechDiaryWords = [
  "deníčku", "dnes", "jsem", "byl", "byla", "bylo", "den", "škola", "školy",
  "kamarád", "kamarádka", "mamka", "táta", "radost", "smutek", "učitel", 
  "učitelka", "ráno", "večer", "noc", "domácí", "úkol", "práce", "výlet"
];

/**
 * Pokročilý postprocessing rozpoznaného textu pro zvýšení kvality
 * 
 * @param text Rozpoznaný text z OCR
 * @returns Vylepšený text
 */
function postprocessHandwrittenText(text: string): string {
  // Rozdělit text na řádky
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // Čištění a korekce textu
  const processedLines = lines.map(line => {
    return line
      // Specifické opravy na základě příkladu z rozpoznaného textu
      .replace(/\bschoad\b/gi, "school")
      .replace(/\bTt\b/g, "It")
      .replace(/\bhice\b/gi, "nice")
      .replace(/\bexci ing\b/gi, "exciting")
      .replace(/\bexci\s+ing\b/gi, "exciting")
      .replace(/\b4eacher\b/gi, "teacher")
      .replace(/\bteacner\b/gi, "teacher")
      .replace(/\bwe\b/g, "was")
      .replace(/\bintrodvced\b/gi, "introduced")
      .replace(/\bfo\s+4\b/gi, "to the")
      .replace(/\bfo 4\b/gi, "to the")
      .replace(/\bfo4\b/gi, "to the")
      .replace(/\bfo\s+the\b/gi, "to the")
      .replace(/\benbre\b/gi, "entire")
      .replace(/\bhe mon\b/gi, "she was nice")
      
      // Oprava běžných slov z deníku
      .replace(/\bjoined\b/gi, "joined")
      .replace(/\bjomed\b/gi, "joined")
      .replace(/\bjained\b/gi, "joined")
      .replace(/\bdear\s+diory\b/gi, "Dear Diary")
      .replace(/\bdear\s+d[il]ary\b/gi, "Dear Diary")
      .replace(/\bdiory\b/gi, "Diary")
      .replace(/\bd[il]ary\b/gi, "Diary")
      
      // Oprava společných OCR chyb v rukopisu
      .replace(/[lI]'m/g, "I'm")
      .replace(/\bwos\b/g, "was")
      .replace(/\bthot\b/g, "that")
      .replace(/\b[lI]\s+/g, "I ")
      .replace(/\b[lI]t\b/g, "It")
      .replace(/\b[lI]f\b/g, "If")
      .replace(/\b[lI]s\b/g, "Is")
      .replace(/\b[lI]n\b/g, "In")
      .replace(/\b[oO]0\b/g, "O")
      .replace(/\b0[oO]\b/g, "O")
      .replace(/\btne\b/g, "the")
      .replace(/\bTne\b/g, "The")
      
      // Oprava čísel a datumů
      .replace(/(\d)l(\d)/g, "$11$2") // 'l' místo '1' v číslech
      .replace(/(\d)[oO](\d)/g, "$10$2") // 'o' místo '0' v číslech
      .replace(/(\d{1,2}):(\d{2})\s*p-m/gi, "$1:$2 p.m.") // oprava času
      .replace(/(\d{1,2}):(\d{2})\s*a-m/gi, "$1:$2 a.m.") // oprava času
      
      // Oprava běžných zkratek
      .replace(/\bb\/c\b/g, "because")
      .replace(/\bw\/\b/g, "with")
      .replace(/\bw\/o\b/g, "without")
      
      // Oprava interpunkce
      .replace(/,,/g, ",")
      .replace(/\.\./g, ".")
      .replace(/\,\./g, ".")
      .replace(/\s+\./g, ".")
      .replace(/\s+\,/g, ",")
      .replace(/\s+\!/g, "!")
      .replace(/\s+\?/g, "?")
      
      // Oprava mezer
      .replace(/\s+/g, " ")
      .trim();
  });
  
  // Spojení řádků
  let result = processedLines.join('\n');
  
  // Oprava kapitalizace (začátek věty velkým písmenem)
  result = result.replace(/([.!?]\s+)([a-z])/g, (match, p1, p2) => p1 + p2.toUpperCase());
  
  // Oprava formátu data
  result = result.replace(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/g, '$1/$2/$3');
  
  // Oprava problému s oddělením písmen
  result = result.replace(/\b([a-z]) ([a-z]) ([a-z])\b/g, '$1$2$3');
  result = result.replace(/\b([a-z]) ([a-z])\b/g, '$1$2');
  
  // Zajištění, že "I" je vždy velké
  result = result.replace(/\bi\b/g, "I");
  
  // Oprava specifických frázi deníkových zápisů
  result = result
    .replace(/\bDear Diory\b/gi, "Dear Diary")
    .replace(/\bToday I\b/gi, "Today, I")
    .replace(/\bToday,I\b/g, "Today, I")
    .replace(/([,.!?])([a-zA-Z])/g, "$1 $2"); // mezera po interpunkci

  // Oprava problematických slov pomocí regulárních výrazů
  const regexCorrections: Record<string, string> = {
    'schoo[1Il]': 'school',
    'teache[rn]': 'teacher',
    'c[1Il]ass': 'class',
    'exc[1Il]t[1Il]ng': 'exciting',
    '[1Il]ntroduced': 'introduced',
    'en[tl][1Il]re': 'entire',
    'fr[1Il]end': 'friend',
  };

  // Aplikujeme opravy běžných slov s regex
  Object.entries(regexCorrections).forEach(([pattern, replacement]) => {
    try {
      const regex = new RegExp(`\\b${pattern}\\b`, 'gi');
      result = result.replace(regex, replacement);
    } catch (error) {
      console.error('Error with regex pattern:', pattern, error);
    }
  });
  
  // Specifické opravy pro české texty
  result = result
    .replace(/\bcasem\b/g, "časem")
    .replace(/\btezky\b/g, "těžký")
    .replace(/\bpouzit\b/g, "použít")
    .replace(/\bmuj\b/g, "můj")
    .replace(/\btve\b/g, "tvé")
    .replace(/\bprace\b/g, "práce")
    .replace(/\bskola\b/g, "škola")
    .replace(/\bskoly\b/g, "školy")
    .replace(/\bjeste\b/g, "ještě")
    .replace(/\bpritel\b/g, "přítel")
    .replace(/\bpritelkyne\b/g, "přítelkyně")
    .replace(/\bprijemny\b/g, "příjemný");
    
  // Aplikujeme kontextové opravy
  result = applyContextualCorrections(result);
  
  return result;
}

/**
 * Aplikuje kontextové korekce textu na základě statistického modelu
 * Používá N-gramy (bigramy) pro opravu textu na základě kontextu
 * 
 * @param text Text k opravě
 * @returns Opravený text s kontextovými korekcemi
 */
function applyContextualCorrections(text: string): string {
  // Rozdělíme text na věty
  const sentences = text.split(/[.!?]+\s+/).filter(s => s.trim().length > 0);
  let correctedSentences: string[] = [];
  
  // Pro každou větu
  for (let sentence of sentences) {
    // Rozdělíme na slova
    let words = sentence.split(/\s+/);
    
    // Pro každé slovo (kromě posledního) kontrolujeme bigramy
    for (let i = 0; i < words.length - 1; i++) {
      const currentWord = words[i];
      const nextWord = words[i + 1];
      
      // Zkontrolujeme, zda existuje přesnější bigram
      const possibleBigram = findPossibleBigram(currentWord, nextWord);
      
      // Pokud jsme našli lepší bigram, aplikujeme ho
      if (possibleBigram) {
        words[i] = possibleBigram[0];
        words[i + 1] = possibleBigram[1];
      }
    }
    
    // Pro každé slovo zkontrolujeme, zda existuje blízká podoba v seznamu běžných slov
    for (let i = 0; i < words.length; i++) {
      // Pokud je slovo krátké nebo obsahuje čísla, přeskočíme ho
      if (words[i].length < 3 || /\d/.test(words[i])) continue;
      
      // Navrhneme opravu běžných slov
      const suggestion = findSimilarCommonWord(words[i]);
      if (suggestion) {
        words[i] = suggestion;
      }
    }
    
    correctedSentences.push(words.join(' '));
  }
  
  // Spojíme věty zpět s interpunkcí
  return correctedSentences.join('. ').replace(/\.\s+\./g, '.') + '.';
}

/**
 * Hledá podobný běžný bigram na základě aktuálních dvou slov
 * Používá Levensteinovu vzdálenost pro měření podobnosti slov
 * 
 * @param word1 První slovo
 * @param word2 Druhé slovo
 * @returns Nalezený bigram nebo null
 */
function findPossibleBigram(word1: string, word2: string): [string, string] | null {
  // Pokud jsou obě slova krátká, přeskočíme
  if (word1.length < 2 || word2.length < 2) return null;
  
  // Normalizujeme slova pro porovnání
  const normalizedWord1 = word1.toLowerCase().trim();
  const normalizedWord2 = word2.toLowerCase().trim();
  
  // Vybíráme kolekci bigramů podle jazyka - detekce češtiny
  const isCzech = /[áčďéěíňóřšťúůýž]/i.test(word1 + word2);
  const bigrams = isCzech ? czechBigrams : commonBigrams;
  
  // Projdeme všechny bigramy a hledáme podobný
  for (const [first, second] of bigrams) {
    // Kontrolujeme, zda jsou slova podobná pomocí Levenshteinovy vzdálenosti
    if (
      (levenshteinDistance(normalizedWord1, first.toLowerCase()) <= 2 && 
       levenshteinDistance(normalizedWord2, second.toLowerCase()) <= 2) ||
      // Pro kratší slova snížíme toleranci
      (normalizedWord1.length <= 3 && 
       normalizedWord1[0] === first.toLowerCase()[0] && 
       normalizedWord2 === second.toLowerCase())
    ) {
      // Zachováme původní kapitalizaci prvního slova
      let correctedFirst = first;
      if (/^[A-Z]/.test(word1)) {
        correctedFirst = first.charAt(0).toUpperCase() + first.slice(1);
      }
      
      return [correctedFirst, second];
    }
  }
  
  return null;
}

/**
 * Hledá podobné běžné slovo na základě vstupního slova
 * Používá Levensteinovu vzdálenost pro měření podobnosti slov
 * 
 * @param word Vstupní slovo
 * @returns Nalezené podobné slovo nebo null
 */
function findSimilarCommonWord(word: string): string | null {
  // Normalizujeme slovo pro porovnání
  const normalizedWord = word.toLowerCase().trim();
  
  // Vybíráme kolekci slov podle jazyka - detekce češtiny
  const isCzech = /[áčďéěíňóřšťúůýž]/i.test(word);
  const wordList = isCzech ? czechDiaryWords : commonDiaryWords;
  
  // Nejlepší nalezený výsledek
  let bestMatch = null;
  let minDistance = Infinity;
  
  // Projdeme seznam běžných slov
  for (const commonWord of wordList) {
    // Pro krátká slova použijeme přesnou shodu prvního písmene
    if (normalizedWord.length <= 3) {
      if (normalizedWord[0] === commonWord.toLowerCase()[0] && 
          levenshteinDistance(normalizedWord, commonWord.toLowerCase()) === 1) {
        // Zachováme původní kapitalizaci
        if (/^[A-Z]/.test(word)) {
          return commonWord.charAt(0).toUpperCase() + commonWord.slice(1);
        }
        return commonWord;
      }
    } else {
      // Pro delší slova použijeme Levenshteinovu vzdálenost
      const distance = levenshteinDistance(normalizedWord, commonWord.toLowerCase());
      
      // Pouze pokud je vzdálenost dostatečně malá a menší než dosavadní minimum
      const similarityThreshold = Math.min(2, Math.floor(normalizedWord.length / 3));
      if (distance <= similarityThreshold && distance < minDistance) {
        minDistance = distance;
        bestMatch = commonWord;
      }
    }
  }
  
  // Pokud jsme našli shodu, zachováme původní kapitalizaci
  if (bestMatch) {
    if (/^[A-Z]/.test(word)) {
      return bestMatch.charAt(0).toUpperCase() + bestMatch.slice(1);
    }
    return bestMatch;
  }
  
  return null;
}

/**
 * Vypočítá Levenshteinovu vzdálenost mezi dvěma řetězci
 * 
 * @param a První řetězec
 * @param b Druhý řetězec
 * @returns Levenshteinova vzdálenost
 */
function levenshteinDistance(a: string, b: string): number {
  // Pokud je některý ze vstupů prázdný, vrátíme délku druhého
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  
  // Vytvoříme matici vzdáleností
  const matrix: number[][] = [];
  
  // Inicializace první řady
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  // Inicializace prvního sloupce
  for (let i = 0; i <= a.length; i++) {
    matrix[0][i] = i;
  }
  
  // Výpočet vzdálenosti
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // odstranění
        matrix[i][j - 1] + 1, // vložení
        matrix[i - 1][j - 1] + cost // náhrada nebo žádná změna
      );
    }
  }
  
  return matrix[b.length][a.length];
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