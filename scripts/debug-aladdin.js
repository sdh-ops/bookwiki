"use strict";

const axios = require('axios');

const ALADIN_API_KEY = 'ttbsue_1201547001';

async function testFetch(title, author) {
  const query = `${title} ${author}`;
  const url = `http://www.aladin.co.kr/ttb/api/ItemSearch.aspx?ttbkey=${ALADIN_API_KEY}&Query=${encodeURIComponent(query)}&QueryType=Keyword&MaxResults=1&start=1&SearchTarget=Book&output=js&Version=20131101`;
  
  console.log(`URL: ${url}`);
  try {
    const response = await axios.get(url);
    console.log('Response Data:', JSON.stringify(response.data, null, 2));
    const item = response.data.item?.[0];
    if (item) {
      console.log('Found:', item.title, 'by', item.author, 'pub:', item.publisher);
    } else {
      console.log('No item found.');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// "오버씽킹 (벳시 홈버그)" was one of the failures
testFetch('오버씽킹', '벳시 홈버그');
