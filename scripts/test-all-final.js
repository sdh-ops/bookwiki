const { 
  initBrowser,
  scrapeKyobo, 
  scrapeYes24, 
  scrapeAladdin, 
  scrapeRidi, 
  scrapeMillie,
  run
} = require('./bestseller-final');

const CATEGORIES = [
  { name: '종합', kyobo: '01', yes24: '001', aladdin: '0', ridi: '100', millie: '1' }
];

async function testAll() {
  console.log('--- Testing Scrapers with New Validation Logic ---');
  
  await initBrowser();
  
  for (const cat of CATEGORIES) {
    console.log(`\nTesting Category: ${cat.name}`);
    
    try {
      console.log('\n[Kyobo]');
      const kyobo = await scrapeKyobo(cat);
      console.log(kyobo.slice(0, 5).map(b => `${b.rank}. ${b.title} (${b.author}) - ${b.isbn}`));
    } catch (e) { console.error('Kyobo failed:', e.message); }

    try {
      console.log('\n[Yes24]');
      const yes24 = await scrapeYes24(cat);
      console.log(yes24.slice(0, 5).map(b => `${b.rank}. ${b.title} (${b.author}) - ${b.isbn}`));
    } catch (e) { console.error('Yes24 failed:', e.message); }

    try {
      console.log('\n[Aladdin]');
      const aladdin = await scrapeAladdin(cat);
      console.log(aladdin.slice(0, 5).map(b => `${b.rank}. ${b.title} (${b.author}) - ${b.isbn}`));
    } catch (e) { console.error('Aladdin failed:', e.message); }

    try {
      console.log('\n[Ridi]');
      const ridi = await scrapeRidi(cat);
      console.log(ridi.slice(0, 5).map(b => `${b.rank}. ${b.title} (${b.author}) - ${b.isbn}`));
    } catch (e) { console.error('Ridi failed:', e.message); }

    try {
      console.log('\n[Millie]');
      const millie = await scrapeMillie(cat);
      console.log(millie.slice(0, 5).map(b => `${b.rank}. ${b.title} (${b.author}) - ${b.isbn}`));
    } catch (e) { console.error('Millie failed:', e.message); }
  }
}

testAll();
