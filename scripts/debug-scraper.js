"use strict";

const axios = require('axios');
const cheerio = require('cheerio');

async function debugKPIPA() {
    console.log('=== Debugging KPIPA PDF Embed ===\n');

    // This post has PDF attachments
    const url = 'https://www.kpipa.or.kr/p/g1_2/2012';
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    // Look for iframes (PDF viewer)
    console.log('iframes count:', $('iframe').length);
    $('iframe').each((i, el) => {
        console.log(`iframe ${i} src:`, $(el).attr('src'));
        console.log(`iframe ${i} name:`, $(el).attr('name'));
    });
    console.log('');

    // Check file section for viewer info
    const fileSection = $('#bo_v_file');
    console.log('#bo_v_file full HTML:\n', fileSection.html());
}

debugKPIPA();
