import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import fetch from 'node-fetch';

// Cesta k testovacímu obrázku
const imagePath = '/tmp/test-images/test.png';

// Kontrola, zda soubor existuje
if (!fs.existsSync(imagePath)) {
  console.error(`Test image not found: ${imagePath}`);
  process.exit(1);
}

async function testOCR() {
  try {
    // Vytvořit FormData s obrázkem
    const form = new FormData();
    form.append('journal', fs.createReadStream(imagePath), { filename: 'test.png' });
    
    // Odeslat požadavek na API s českým jazykem
    console.log('Sending request to OCR API with Czech language...');
    const response = await fetch('http://localhost:5000/api/journal/upload/kraken?language=ces', {
      method: 'POST',
      body: form
    });
    
    if (!response.ok) {
      const text = await response.text();
      console.error(`API returned error: ${response.status} ${response.statusText}`);
      console.error(`Response: ${text}`);
      process.exit(1);
    }
    
    // Zpracovat odpověď
    const result = await response.json();
    console.log('OCR Result:');
    console.log(JSON.stringify(result, null, 2));
    
    // Zkontrolovat, zda odpověď obsahuje rozpoznaný text
    if (result && result.text) {
      console.log('\nRecognized Text:');
      console.log(result.text);
      console.log(`\nConfidence: ${result.confidence || 'N/A'}`);
      console.log('\nOCR Test Successful!');
    } else {
      console.error('OCR test failed - no recognized text in response');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error during OCR test:', error);
    process.exit(1);
  }
}

// Spustit test
testOCR();
