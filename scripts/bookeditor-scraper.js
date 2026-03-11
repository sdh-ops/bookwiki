"use strict";

const axios = require('axios');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');
const { supabase } = require('./common');
const qs = require('qs');

const MAX_POSTS = 100;
const START_DATE = new Date('2026-03-01');
const BE_USER = process.env.BOOKEDITOR_ID || 'sdh0815';
const BE_PASS = process.env.BOOKEDITOR_PW || 'Sk18061806!';

async function scrapeBookEditor() {
    console.log('Starting BookEditor scraping...');
    const baseUrl = 'http://bookeditor.org';
    const posts = [];

    try {
        // Login
        console.log('Logging in...');
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
        console.log('Login done.');

        let start = 0;
        const pageSize = 25;

        while (posts.length < MAX_POSTS) {
            const listUrl = `${baseUrl}/editorplaza/sub9/blist.php?start=${start}`;
            console.log(`Fetching list (start=${start})...`);

            const listResponse = await axios.get(listUrl, {
                responseType: 'arraybuffer',
                headers: { 'Cookie': sessionCookie, 'User-Agent': 'Mozilla/5.0' }
            });
            const listHtml = iconv.decode(Buffer.from(listResponse.data), 'euc-kr');
            const $list = cheerio.load(listHtml);

            const rows = $list('tr[bgcolor]');
            if (rows.length === 0) break;

            for (let i = 0; i < rows.length && posts.length < MAX_POSTS; i++) {
                const el = rows[i];
                const titleLink = $list(el).find('a.board');
                const tds = $list(el).find('td');

                if (titleLink.length > 0 && tds.length >= 5) {
                    const titleText = titleLink.text().trim();
                    const postId = parseInt($list(tds[0]).text().trim());

                    // 공지, re:, Re: 등 답글 필터링
                    const lowerTitle = titleText.toLowerCase();
                    if (!isNaN(postId) && !titleText.includes('공지') && !lowerTitle.startsWith('re:') && !lowerTitle.startsWith('re ')) {
                        const detailUrl = `${baseUrl}/editorplaza/sub9/bread.php?id=${postId}&code=bepsub9&start=0`;
                        const author = $list(tds[4]).text().trim() || '익명';

                        // Date filter
                        const dateText = $list(tds[2]).text().trim() || $list(tds[3]).text().trim();
                        const dateMatch = dateText.match(/(\d{2,4})[-/](\d{2})[-/](\d{2})/);
                        if (dateMatch) {
                            const year = dateMatch[1].length === 2 ? 2000 + parseInt(dateMatch[1]) : parseInt(dateMatch[1]);
                            const postDate = new Date(year, parseInt(dateMatch[2]) - 1, parseInt(dateMatch[3]));
                            if (postDate < START_DATE) {
                                console.log(`  ⏭ Skipping old: ${titleText.substring(0, 25)}...`);
                                continue;
                            }
                        }

                        if (posts.find(p => p.source_url === detailUrl)) continue;

                        try {
                            const detailResponse = await axios.get(detailUrl, {
                                responseType: 'arraybuffer',
                                headers: { 'Cookie': sessionCookie, 'User-Agent': 'Mozilla/5.0' }
                            });
                            const detailHtml = iconv.decode(Buffer.from(detailResponse.data), 'euc-kr');
                            const $ = cheerio.load(detailHtml);

                            $('script, style, link, meta, noscript').remove();

                            // Find content in table with width=575 (the content table)
                            let content = '';
                            let authorEmail = '';

                            // The structure: table width=575 contains author info and content
                            $('table[width="575"]').each((_, table) => {
                                const tableHtml = $(table).html() || '';
                                const tableText = $(table).text().replace(/\s+/g, ' ').trim();

                                // Skip the title row table
                                if (tableText.length < 100) return;

                                // This should be the content table
                                // It has "작성자" and the actual post content

                                // Extract author email
                                const emailMatch = tableHtml.match(/mailto:([^"]+)/);
                                if (emailMatch) {
                                    authorEmail = emailMatch[1];
                                }

                                // Find the content paragraph
                                const contentTd = $(table).find('td p.style1');
                                if (contentTd.length > 0) {
                                    contentTd.each((_, p) => {
                                        const pStyle = $(p).attr('style') || '';
                                        // The content p usually has margin-left:20px
                                        if (pStyle.includes('margin-left') || pStyle.includes('margin-top')) {
                                            const pHtml = $(p).html()?.trim();
                                            if (pHtml && pHtml.length > content.length) {
                                                content = pHtml;
                                            }
                                        }
                                    });
                                }

                                // If not found, try getting all trs with content
                                if (!content || content.length < 100) {
                                    $(table).find('tr').each((_, tr) => {
                                        const trText = $(tr).text().replace(/\s+/g, ' ').trim();
                                        const trHtml = $(tr).html() || '';

                                        // Look for the row with actual content (not author row)
                                        if (trText.length > 200 && !trText.startsWith('작성자')) {
                                            // Get the inner content
                                            const innerContent = $(tr).find('td').html()?.trim();
                                            if (innerContent && innerContent.length > content.length) {
                                                content = innerContent;
                                            }
                                        }
                                    });
                                }
                            });

                            // Clean up content
                            content = content
                                .replace(/<script[\s\S]*?<\/script>/gi, '')
                                .replace(/<style[\s\S]*?<\/style>/gi, '')
                                .replace(/<!--[\s\S]*?-->/g, '')
                                // Convert <br> tags to proper line breaks for display
                                .replace(/<br\s*\/?>/gi, '<br>')
                                .trim();

                            // Fix image URLs
                            content = content.replace(/src="(?!http)([^"]+)"/g, `src="${baseUrl}/editorplaza/sub9/$1"`);

                            // Add author email if found
                            if (authorEmail && content.length > 50) {
                                content = `<div style="background:#f5f5f5;padding:10px 15px;margin-bottom:15px;border-radius:6px;font-size:13px;"><strong>✉️ 연락처:</strong> <a href="mailto:${authorEmail}">${authorEmail}</a></div>\n${content}`;
                            }

                            // Style the content for better readability
                            if (content.length > 50) {
                                content = `<div style="line-height:1.8;font-size:14px;">${content}</div>`;
                            }

                            if (content.length > 100) {
                                posts.push({
                                    title: titleText,
                                    source_url: detailUrl,
                                    author: author,
                                    board_type: 'job',
                                    is_auto: true,
                                    content: content
                                });
                                console.log(`[${posts.length}/${MAX_POSTS}] ✓ ${titleText.substring(0, 35)}... (${content.length} chars)`);
                            } else {
                                console.log(`  ⚠ No content: ${titleText.substring(0, 30)}...`);
                            }

                            await new Promise(r => setTimeout(r, 150));
                        } catch (err) {
                            console.error(`Failed: ${titleText.substring(0, 25)}... - ${err.message}`);
                        }
                    }
                }
            }

            start += pageSize;
            if (start > 500) break;
        }

        console.log(`\nTotal scraped: ${posts.length} posts.`);

        let saved = 0;
        for (const post of posts) {
            const { error } = await supabase.from('bw_posts').upsert(post, { onConflict: 'source_url' });
            if (!error || error.code === '23505') saved++;
            else console.error(`DB Error: ${error.message}`);
        }

        console.log(`Saved ${saved} posts.`);
    } catch (err) {
        console.error('BookEditor scraping failed:', err.message);
    }
}

scrapeBookEditor();
