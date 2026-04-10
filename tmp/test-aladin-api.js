const axios = require('axios');
const ALADIN_API_KEY = 'ttbsue_1201547001';

async function testFetchMissing() {
    const title = '프로젝트 헤일메리';
    const author = '앤디 위어';
    
    try {
        const url = 'http://www.aladin.co.kr/ttb/api/ItemSearch.aspx';
        const params = {
          ttbkey: ALADIN_API_KEY,
          Query: title,
          QueryType: 'Keyword',
          MaxResults: 2,
          start: 1,
          SearchTarget: 'Book',
          output: 'js',
          Version: '20131101'
        };
        const response = await axios.get(url, { params });
        console.log("Response Type:", typeof response.data);
        console.log(response.data);
    } catch(e) {
        console.error(e.message);
    }
}
testFetchMissing();
