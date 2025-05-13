import fetch from 'node-fetch';

async function testJournalEntries() {
  try {
    console.log('Testování API journal entries...');
    
    // Získat seznam dostupných journal entries
    const response = await fetch('http://localhost:5000/api/journal/entries');
    
    if (!response.ok) {
      console.error(`API vrátila chybu: ${response.status} ${response.statusText}`);
      process.exit(1);
    }
    
    // Zpracovat odpověď
    const result = await response.json();
    const entries = result.entries || [];
    console.log('Výsledek journal entries API:');
    console.log(JSON.stringify(result, null, 2));
    
    if (Array.isArray(entries) && entries.length > 0) {
      console.log(`\nNačteno ${entries.length} journal entries`);
      
      // Zobrazit 3 poslední entries, pokud existují
      const sampleSize = Math.min(3, entries.length);
      console.log(`\nPosledních ${sampleSize} zápisů:`);
      
      // Seřadit podle createdAt sestupně
      const sortedEntries = [...entries].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      for (let i = 0; i < sampleSize; i++) {
        const entry = sortedEntries[i];
        // Zkrátit obsah na 100 znaků pro přehlednost
        const shortContent = entry.content.length > 100 
          ? entry.content.substring(0, 100) + '...' 
          : entry.content;
          
        console.log(`- ${entry.date}: ${shortContent}`);
      }
      
      // Otestujme také insights API
      console.log('\nTestování journal insights API...');
      const insightsResponse = await fetch('http://localhost:5000/api/journal/insights');
      
      if (!insightsResponse.ok) {
        console.error(`Insights API vrátila chybu: ${insightsResponse.status} ${insightsResponse.statusText}`);
      } else {
        const insights = await insightsResponse.json();
        console.log('Výsledek journal insights API:');
        console.log(JSON.stringify(insights, null, 2));
      }
      
      console.log('\nTest journal entries úspěšný!');
    } else {
      console.log('Žádné journal entries zatím nejsou k dispozici.');
    }
  } catch (error) {
    console.error('Chyba při testování journal entries API:', error);
    process.exit(1);
  }
}

// Spustit test
testJournalEntries();
