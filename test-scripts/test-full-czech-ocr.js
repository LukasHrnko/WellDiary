import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { createCanvas } from 'canvas';
import path from 'path';

// Nastavení cesty k testovacímu obrázku
const outputPath = '/tmp/test-images/czech-text.png';

// Vytvoření canvas pro kreslení textu
console.log('Generování testovacího obrázku s českým textem...');
const width = 800;
const height = 400;
const canvas = createCanvas(width, height);
const ctx = canvas.getContext('2d');

// Nastavení pozadí
ctx.fillStyle = '#f0f0f0';
ctx.fillRect(0, 0, width, height);

// Nastavení textu
ctx.fillStyle = '#000000';
ctx.font = '28px Arial';
ctx.textAlign = 'center';

// Český text s diakritikou
const czechText = [
  'Příliš žluťoučký kůň úpěl ďábelské ódy.',
  'České samolásky: á, é, í, ó, ú, ů, ý',
  'Speciální znaky: č, ď, ě, ň, ř, š, ť, ž',
  'Ahoj, jak se máš? Já se mám dobře.',
  'Můj deník - zápis z dnešního dne.',
  'Dnes jsem se naučil něco nového.'
];

// Vykreslení textu
let yPos = 50;
for (const line of czechText) {
  ctx.fillText(line, width / 2, yPos);
  yPos += 50;
}

// Uložení obrázku
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync(outputPath, buffer);
console.log(`Testovací obrázek vytvořen: ${outputPath}`);

// Funkce pro testování OCR API
async function testCzechOCR() {
  try {
    // Vytvoření FormData s obrázkem
    const form = new FormData();
    form.append('journal', fs.createReadStream(outputPath), { filename: 'czech-text.png' });
    
    // Odeslání požadavku na API s českým jazykem
    console.log('Odesílání požadavku na OCR API s českým jazykem...');
    const response = await fetch('http://localhost:5000/api/journal/upload/kraken?language=ces', {
      method: 'POST',
      body: form
    });
    
    if (!response.ok) {
      const text = await response.text();
      console.error(`API vrátila chybu: ${response.status} ${response.statusText}`);
      console.error(`Odpověď: ${text}`);
      process.exit(1);
    }
    
    // Zpracování odpovědi
    const result = await response.json();
    console.log('OCR Výsledek:');
    console.log(JSON.stringify(result, null, 2));
    
    // Kontrola, zda odpověď obsahuje rozpoznaný text
    if (result && result.text) {
      console.log('\nRozpoznaný text:');
      console.log(result.text);
      console.log(`\nSpolehlivost: ${result.confidence || 'N/A'}`);
      
      // Základní porovnání s původním textem
      const originalText = czechText.join(' ');
      console.log('\nPorovnání s původním textem:');
      console.log('Původní text:  ' + originalText);
      console.log('Rozpoznaný text: ' + result.text);
      
      console.log('\nTest českého OCR úspěšný!');
    } else {
      console.error('OCR test selhal - žádný rozpoznaný text v odpovědi');
      process.exit(1);
    }
  } catch (error) {
    console.error('Chyba během OCR testu:', error);
    process.exit(1);
  }
}

// Spuštění testu
testCzechOCR();
