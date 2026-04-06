"use strict";

const axios = require('axios');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');
const qs = require('qs');

async function debug() {
    const baseUrl = 'http://bookeditor.org';
    const BE_USER = 'sdh0815';
    const BE_PASS = 'Sk18061806!';

    // Login
    let sessionCookie = '';
    try {
        const loginResponse = await axios.post(`${baseUrl}/login/logincheck.php`,
            qs.stringify({ id: BE_USER, passwd: BE_PASS }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' },
            maxRedirects: 0,
            validateStatus: (status) => status >= 200 && status < 400
        });
        const cookies = loginResponse.headers['set-cookie'];
        sessionCookie = cookies ? cookies.join('; ') : '';
    } catch (e) {}

    // Fetch a specific post
    const postUrl = 'http://bookeditor.org/editorplaza/sub9/bread.php?id=91756&code=bepsub9&start=0';

    const response = await axios.get(postUrl, {
        responseType: 'arraybuffer',
        headers: { 'Cookie': sessionCookie, 'User-Agent': 'Mozilla/5.0' }
    });
    const html = iconv.decode(Buffer.from(response.data), 'euc-kr');
    const $ = cheerio.load(html);

    // Remove scripts
    $('script, style').remove();

    console.log('=== BookEditor Page Structure ===\n');
    console.log('Status:', response.status);
    console.log('Content Length:', response.data.length);
    console.log('HTML Start:', html.substring(0, 500));

    // Look at different areas
    console.log('Tables count:', $('table').length);

    // Find the main content - look for tables with specific width
    $('table').each((i, table) => {
        const width = $(table).attr('width');
        const text = $(table).text().replace(/\s+/g, ' ').trim().substring(0, 200);
        if (width && parseInt(width) > 500) {
            console.log(`\nTable ${i} (width=${width}):`);
            console.log('Text preview:', text);
        }
    });

    // Look for content markers
    console.log('\n\n=== Looking for content patterns ===');

    // Find text that contains job posting patterns
    $('td').each((i, td) => {
        const text = $(td).text().replace(/\s+/g, ' ').trim();
        if (text.includes('모집분야') || text.includes('접수기간') || text.includes('근무조건')) {
            console.log(`\nTD ${i} contains job content:`);
            console.log('Length:', text.length);
            console.log('Preview:', text.substring(0, 500));
            console.log('HTML preview:', $(td).html()?.substring(0, 500));
        }
    });
}

debug();
