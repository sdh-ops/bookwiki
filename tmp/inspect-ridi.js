const axios = require('axios');
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };

async function test() {
  try {
    const res = await axios.get('https://ridibooks.com/category/bestsellers/100', { headers: HEADERS });
    const match = res.data.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
    const data = JSON.parse(match[1]);
    const queries = data.props.pageProps.dehydratedState.queries;
    const cq = queries.find(q => q.queryKey[0] === 'category/detail' && q.queryKey[1]?.category_id === 100);
    if (cq) {
      console.log('Book 0 Sample:', JSON.stringify(cq.state.data[0], null, 2).substring(0, 500));
    }
  } catch (e) {
    console.error(e);
  }
}
test();
