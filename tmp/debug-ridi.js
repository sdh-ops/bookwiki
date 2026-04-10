const axios = require('axios');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

async function testRidi() {
  console.log('--- Ridi Test (Category 100) ---');
  try {
    const url = 'https://ridibooks.com/category/bestsellers/100';
    const res = await axios.get(url, { headers: HEADERS });
    const match = res.data.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
    if (!match) {
      console.log('__NEXT_DATA__ not found');
      return;
    }
    const data = JSON.parse(match[1]);
    const queries = data.props?.pageProps?.dehydratedState?.queries || [];
    // Log query keys to find the right one
    queries.forEach((q, i) => {
      console.log(`Query ${i} Key:`, JSON.stringify(q.queryKey).slice(0, 50) + '...');
    });
    
    const bestsellersQuery = queries.find(q => q.state?.data?.bestsellers);
    if (!bestsellersQuery) {
      console.log('Bestsellers query not found in any queries');
    } else {
      console.log('Found Bestsellers! Count:', bestsellersQuery.state.data.bestsellers.items.length);
    }
  } catch (e) {
    console.error('Ridi Test Failed:', e.message);
  }
}

testRidi();
