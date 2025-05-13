import fetch from 'node-fetch';

async function testAchievements() {
  try {
    console.log('Testování API achievements...');
    
    // Získat seznam dostupných achievements
    const response = await fetch('http://localhost:5000/api/achievements');
    
    if (!response.ok) {
      console.error(`API vrátila chybu: ${response.status} ${response.statusText}`);
      process.exit(1);
    }
    
    // Zpracovat odpověď
    const result = await response.json();
    console.log('Výsledek achievement API:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result && result.achievements && Array.isArray(result.achievements)) {
      console.log(`\nNačteno ${result.achievements.length} achievementů:`);
      
      // Zobrazit 3 příklady achievementů, pokud existují
      const sampleSize = Math.min(3, result.achievements.length);
      for (let i = 0; i < sampleSize; i++) {
        console.log(`- ${result.achievements[i].title}: ${result.achievements[i].description}`);
      }
      
      console.log('\nTest achievements úspěšný!');
    } else {
      console.error('Test selhal - neočekávaný formát odpovědi');
      process.exit(1);
    }
  } catch (error) {
    console.error('Chyba při testování achievements API:', error);
    process.exit(1);
  }
}

// Spustit test
testAchievements();
