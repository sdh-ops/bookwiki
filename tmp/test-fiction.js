const { initBrowser, scrapeKyobo, scrapeYes24, scrapeAladdin, scrapeRidi, scrapeMillie, run } = require('./scripts/bestseller-final.js');

const CATEGORY_FICTION = { name: '소설', yes24: '001001046', aladin: '1', kyobo: '01', ridi: '100', millie: 'story' };

async function testSingle() {
  await initBrowser();
  try {
    console.log('--- Testing Fiction Category ---');
    // Using the exported functions directly might be harder if sync is internal.
    // I'll just temporarily modify main in the final script to only run for Fiction.
    // Actually, I'll just run a node command with a modified loop.
  } catch (e) {
    console.error(e);
  }
}
