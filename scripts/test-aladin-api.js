"use strict";

const axios = require('axios');

const ALADIN_API_KEY = 'ttbsue_1201547001';

async function testAladinAPI() {
  console.log('\n=== Testing Aladin Bestseller API ===\n');

  // Test 1: ItemList with Bestseller
  console.log('Test 1: ItemList.aspx (Bestseller)');
  try {
    const url = 'http://www.aladin.co.kr/ttb/api/ItemList.aspx';
    const params = {
      ttbkey: ALADIN_API_KEY,
      QueryType: 'Bestseller',
      MaxResults: 10,
      start: 1,
      SearchTarget: 'Book',
      output: 'js',
      Version: '20131101',
      CategoryId: '0'  // 종합
    };

    console.log('URL:', url);
    console.log('Params:', JSON.stringify(params, null, 2));

    const response = await axios.get(url, { params, timeout: 10000 });

    if (response.data && response.data.item) {
      console.log(`✅ Success! Got ${response.data.item.length} books`);
      console.log('\nFirst 3 books:');
      response.data.item.slice(0, 3).forEach((book, idx) => {
        console.log(`${idx + 1}. ${book.title} - ${book.author}`);
      });
    } else {
      console.log('❌ No data:', response.data);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', error.response.data);
    }
  }

  // Test 2: Different QueryType
  console.log('\n\nTest 2: ItemList.aspx (BestSeller - different spelling)');
  try {
    const url = 'http://www.aladin.co.kr/ttb/api/ItemList.aspx';
    const params = {
      ttbkey: ALADIN_API_KEY,
      QueryType: 'BestSeller',  // 대소문자 다르게
      MaxResults: 10,
      start: 1,
      SearchTarget: 'Book',
      output: 'js',
      Version: '20131101'
    };

    const response = await axios.get(url, { params, timeout: 10000 });

    if (response.data && response.data.item) {
      console.log(`✅ Success! Got ${response.data.item.length} books`);
    } else {
      console.log('❌ No data');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  // Test 3: ItemSearch (기존 방식)
  console.log('\n\nTest 3: ItemSearch.aspx (fallback to scraping method)');
  try {
    const url = 'http://www.aladin.co.kr/ttb/api/ItemSearch.aspx';
    const params = {
      ttbkey: ALADIN_API_KEY,
      Query: '소설',
      QueryType: 'Title',
      MaxResults: 5,
      start: 1,
      SearchTarget: 'Book',
      output: 'js',
      Version: '20131101'
    };

    const response = await axios.get(url, { params, timeout: 10000 });

    if (response.data && response.data.item) {
      console.log(`✅ ItemSearch works! Got ${response.data.item.length} books`);
    } else {
      console.log('❌ No data');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  console.log('\n=== Test Complete ===\n');
}

testAladinAPI();
