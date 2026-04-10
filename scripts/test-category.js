const { initBrowser, scrapeKyobo, scrapeYes24, scrapeAladdin, scrapeRidi, scrapeMillie } = require('./bestseller-final');

const TEST_CATEGORY = {
  name: '사회과학',
  kyobo: '05',
  yes24: '001001022',
  aladdin: '798',
  ridi: '300',
  millie: '10'
};

async function test() {
  console.log(`--- Testing Category: ${TEST_CATEGORY.name} ---`);
  await initBrowser();
  
  try {
    console.log('Kyobo...');
    const kyobo = await scrapeKyobo(TEST_CATEGORY);
    console.log(`  Found ${kyobo.length} books.`);
    if (kyobo.length > 0) console.log(`  Sample: ${kyobo[0].title} / ${kyobo[0].author} / ${kyobo[0].publisher}`);

    console.log('Yes24...');
    const yes24 = await scrapeYes24(TEST_CATEGORY);
    console.log(`  Found ${yes24.length} books.`);
    if (yes24.length > 0) console.log(`  Sample: ${yes24[0].title} / ${yes24[0].author} / ${yes24[0].publisher}`);

    console.log('Aladin...');
    const aladin = await scrapeAladdin(TEST_CATEGORY);
    console.log(`  Found ${aladin.length} books.`);
    if (aladin.length > 0) console.log(`  Sample: ${aladin[0].title} / ${aladin[0].author} / ${aladin[0].publisher}`);

    console.log('Ridi...');
    const ridi = await scrapeRidi(TEST_CATEGORY);
    console.log(`  Found ${ridi.length} books.`);
    if (ridi.length > 0) console.log(`  Sample: ${ridi[0].title} / ${ridi[0].author} / ${ridi[0].publisher}`);

    console.log('Millie...');
    const millie = await scrapeMillie(TEST_CATEGORY);
    console.log(`  Found ${millie.length} books.`);
    if (millie.length > 0) console.log(`  Sample: ${millie[0].title} / ${millie[0].author} / ${millie[0].publisher}`);

  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    process.exit(0);
  }
}

test();
