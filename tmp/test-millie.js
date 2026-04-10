const { initBrowser, scrapeMillie } = require('../scripts/bestseller-final.js');

async function run() {
  await initBrowser();
  const cat = { name: '종합', millie: '0' };
  const books = await scrapeMillie(cat);
  console.log("Millie scraped items:", JSON.stringify(books.slice(0, 5), null, 2));
  process.exit(0);
}
run();
