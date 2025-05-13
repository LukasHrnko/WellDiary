/**
 * Jednoduchá Node.js implementace TrOCR
 * pro rozpoznávání textu z obrázků s českým textem
 */

const fs = require('fs');
const path = require('path');
const { createWorker } = require('tesseract.js');

async function performOCR(imagePath, language = 'eng') {
  try {
    const worker = await createWorker();
    
    // Nastavení jazyka
    const langCode = language === 'ces' ? 'ces+eng' : language;
    await worker.loadLanguage(langCode);
    await worker.initialize(langCode);
    
    // Nastavení parametrů pro lepší rozpoznávání rukopisu
    await worker.setParameters({
      tessedit_pageseg_mode: '6', // Předpokládáme jeden blok textu
      tessedit_ocr_engine_mode: '1',  // Použití neural net LSTM engine
    });
    
    const result = await worker.recognize(imagePath);
    await worker.terminate();
    
    // Úprava výstupu pro lepší čitelnost
    const text = result.data.text.trim();
    
    console.log('OCR dokončeno úspěšně');
    
    return {
      success: true,
      text,
      confidence: result.data.confidence / 100,  // Převod na rozsah 0-1
    };
  } catch (error) {
    console.error('Chyba při OCR zpracování:', error);
    return {
      success: false,
      text: '',
      error: `OCR zpracování selhalo: ${error.message}`
    };
  }
}

// Zpracování argumentů z příkazové řádky
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Použití: node node_trocr.js <cesta_k_obrázku> [jazyk]');
  process.exit(1);
}

const imagePath = args[0];
const language = args.length > 1 ? args[1] : 'eng';

// Kontrola existence souboru
if (!fs.existsSync(imagePath)) {
  console.error(`Soubor ${imagePath} neexistuje`);
  console.log(JSON.stringify({
    success: false,
    text: '',
    error: `Soubor ${imagePath} neexistuje`
  }));
  process.exit(1);
}

// Spuštění OCR
performOCR(imagePath, language)
  .then(result => {
    console.log(JSON.stringify(result));
  })
  .catch(error => {
    console.error('Neočekávaná chyba:', error);
    console.log(JSON.stringify({
      success: false,
      text: '',
      error: `Neočekávaná chyba: ${error.message}`
    }));
    process.exit(1);
  });