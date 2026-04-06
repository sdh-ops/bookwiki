"use strict";

const cheerio = require('cheerio');
const iconv = require('iconv-lite');
const { supabase } = require('./common');
const qs = require('qs');
const { fetchWithRetry } = require('./scraper-utils');

function isValidPost(title) {
    if (!title || title.length < 2) return false;
    const blacklist = [
        '로그인', '회원가입', '공지사항', '테스트', '샘플', '광고', '배너',
        '필독', '안내', '일정', '시스템', '점검', '축하', '환영'
    ];
    const lowerTitle = title.toLowerCase();
    return !blacklist.some(word => lowerTitle.includes(word));
}

const MAX_POSTS = 100;
const LOOKBACK_DAYS = 60; // Job posts might stay up longer
const BE_USER = process.env.BOOKEDITOR_ID || 'sdh0815';
const BE_PASS = process.env.BOOKEDITOR_PW || 'Sk18061806!';

async function scrapeBookEditor() {
    console.log('🚀 Starting BookEditor scraping...');
    const baseUrl = 'http://bookeditor.org';
    const posts = [];

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - LOOKBACK_DAYS);
    console.log(`📅 Dynamic Lookback: From ${startDate.toISOString().split('T')[0]}`);

    try {
        // DB Pre-check
        console.log('🔍 Fetching existing posts from DB...');
        const { data: existingPosts, error: dbError } = await supabase
            .from('bw_posts')
            .select('source_url')
            .eq('board_type', 'job')
            .eq('is_auto', true);

        if (dbError) throw new Error(`DB Fetch failed: ${dbError.message}`);
        const existingUrls = new Set(existingPosts?.map(p => p.source_url) || []);
        console.log(`✅ Loaded ${existingUrls.size} existing URLs.`);

        // Login
        console.log('🔐 Logging in to BookEditor...');
        let sessionCookie = '';
        try {
            const loginResponse = await fetchWithRetry(`${baseUrl}/login/logincheck.php`, {
                method: 'post',
                data: qs.stringify({ id: BE_USER, passwd: BE_PASS }),
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                maxRedirects: 0,
                validateStatus: (status) => status >= 200 && status < 400
            });
            const cookies = loginResponse.headers['set-cookie'];
            // Extract only name=value part (before first ';') to avoid bleeding cookie attributes
            sessionCookie = cookies ? cookies.map(c => c.split(';')[0]).join('; ') : '';
            if (!sessionCookie) {
                console.warn('  ⚠️ No session cookie received. Site might be down or login failed.');
                console.warn(`  ℹ️ Login status: ${loginResponse.status}, headers: ${JSON.stringify(Object.keys(loginResponse.headers))}`);
            } else {
                console.log(`  ✅ Login successful. Cookies: ${sessionCookie.substring(0, 60)}...`);
            }
        } catch (e) {
            if (e.message === 'TRAFFIC_LIMIT_EXCEEDED') {
                console.error('  🛑 Aborting due to traffic limit.');
                return;
            }
            console.warn(`  ⚠️ Login failed: ${e.message}. Continuing as guest...`);
        }

        let start = 0;
        const pageSize = 25;
        let reachedOldPosts = false;

        while (posts.length < MAX_POSTS && !reachedOldPosts) {
            const listUrl = `${baseUrl}/editorplaza/sub9/blist.php?start=${start}`;
            console.log(`\n📄 Fetching list page (start=${start})...`);

            let listResponse;
            try {
                listResponse = await fetchWithRetry(listUrl, {
                    responseType: 'arraybuffer',
                    headers: { 'Cookie': sessionCookie }
                });
            } catch (e) {
                if (e.message === 'TRAFFIC_LIMIT_EXCEEDED') break;
                throw e;
            }

            const listHtml = iconv.decode(Buffer.from(listResponse.data), 'euc-kr');
            const $list = cheerio.load(listHtml);

            // Try multiple selectors as fallback (site HTML may vary)
            let rows = $list('tr[bgcolor]');
            if (rows.length === 0) rows = $list('tr[onmouseover]');
            if (rows.length === 0) rows = $list('table tr').filter((_, el) => $list(el).find('a[href*="id="], a[onclick*="id="]').length > 0);
            if (rows.length === 0) {
                console.log('⚠️ No rows found. List might be empty or selectors failed.');
                console.log(`  ℹ️ HTML preview: ${listHtml.substring(0, 500)}`);
                break;
            }
            console.log(`  ✅ Found ${rows.length} rows.`);

            for (let i = 0; i < rows.length && posts.length < MAX_POSTS; i++) {
                const el = rows[i];
                const titleLink = $list(el).find('a.board');
                const tds = $list(el).find('td');

                if (titleLink.length > 0 && tds.length >= 5) {
                    const titleText = titleLink.text().trim();
                    const onclick = titleLink.attr('onclick') || '';
                    const href = titleLink.attr('href') || '';
                    const idMatch = (onclick + href).match(/id=(\d+)/);
                    const postId = idMatch ? parseInt(idMatch[1]) : NaN;

                    if (isNaN(postId)) continue;

                    // Detail URL
                    const detailUrl = `${baseUrl}/editorplaza/sub9/bread.php?id=${postId}&code=bepsub9&start=0`;
                    
                    // Pre-check skip
                    if (existingUrls.has(detailUrl)) {
                        console.log(`  ⏭ Skipping (already in DB): ${titleText.substring(0, 35)}...`);
                        continue;
                    }

                    // Filtering
                    if (!isValidPost(titleText) || titleText.includes('공지')) continue;
                    const lowerTitle = titleText.toLowerCase();
                    if (lowerTitle.startsWith('re:') || lowerTitle.startsWith('re ')) continue;

                    const author = $list(tds[4]).text().trim() || '익명';
                    const dateText = $list(tds[2]).text().trim() || $list(tds[3]).text().trim();
                    
                    // Date evaluation
                    const dateMatch = dateText.match(/(\d{2,4})[-/](\d{2})[-/](\d{2})/);
                    if (dateMatch) {
                        const year = dateMatch[1].length === 2 ? 2000 + parseInt(dateMatch[1]) : parseInt(dateMatch[1]);
                        const postDate = new Date(year, parseInt(dateMatch[2]) - 1, parseInt(dateMatch[3]));
                        if (postDate < startDate) {
                            console.log(`  ⏭ Skipping (too old: ${dateText}): ${titleText.substring(0, 25)}...`);
                            reachedOldPosts = true;
                            continue;
                        }
                    }

                    try {
                        const detailResponse = await fetchWithRetry(detailUrl, {
                            responseType: 'arraybuffer',
                            headers: { 'Cookie': sessionCookie }
                        });
                        const detailHtml = iconv.decode(Buffer.from(detailResponse.data), 'euc-kr');
                        const $ = cheerio.load(detailHtml);

                        $('script, style, link, meta, noscript').remove();

                        // Better content extraction with fallbacks
                        let content = '';
                        // Priority 1: style1 class in content area
                        const contentTd = $('td p.style1, .style1');
                        if (contentTd.length > 0) {
                            contentTd.each((_, p) => {
                                const pHtml = $(p).html()?.trim();
                                if (pHtml && pHtml.length > content.length) content = pHtml;
                            });
                        }

                        // Priority 2: width 575 table (legacy layout)
                        if (content.length < 100) {
                            $('table[width="575"], table[width="550"]').each((_, table) => {
                                $(table).find('tr').each((_, tr) => {
                                    const trText = $(tr).text().replace(/\s+/g, ' ').trim();
                                    if (trText.length > 200 && !trText.startsWith('작성자')) {
                                        const innerHtml = $(tr).find('td').html()?.trim();
                                        if (innerHtml && innerHtml.length > content.length) content = innerHtml;
                                    }
                                });
                            });
                        }

                        // Priority 3: Fallback search for any large text block
                        if (content.length < 100) {
                            $('td').each((_, td) => {
                                const tdHtml = $(td).html()?.trim();
                                if (tdHtml && tdHtml.length > 300 && !tdHtml.includes('<table')) {
                                    if (tdHtml.length > content.length) content = tdHtml;
                                }
                            });
                        }

                        if (content.length > 100) {
                            // Clean up
                            content = content
                                .replace(/<!--[\s\S]*?-->/g, '')
                                .replace(/<br\s*\/?>/gi, '<br>')
                                .replace(/src="(?!http)([^"]+)"/g, `src="${baseUrl}/editorplaza/sub9/$1"`)
                                .trim();

                            posts.push({
                                title: titleText,
                                source_url: detailUrl,
                                author: author,
                                board_type: 'job',
                                is_auto: true,
                                content: `<div style="line-height:1.8;font-size:14px;">${content}</div>`
                            });
                            console.log(`  [${posts.length}] ✓ ${titleText.substring(0, 35)}... (${content.length} chars)`);
                        } else {
                            console.warn(`  ⚠️ Content extraction failed for: ${titleText.substring(0, 30)}...`);
                        }

                        await new Promise(r => setTimeout(r, 1500));
                    } catch (err) {
                        if (err.message === 'TRAFFIC_LIMIT_EXCEEDED') {
                            reachedOldPosts = true; // Stop early
                            break;
                        }
                        console.error(`  ❌ Failed detail: ${titleText.substring(0, 25)}... - ${err.message}`);
                    }
                }
            }

            start += pageSize;
            if (start > 500) break;
        }

        console.log(`\n🏁 Scraping finished. Total new items: ${posts.length}`);

        if (posts.length > 0) {
            console.log('💾 Saving to database...');
            let saved = 0;
            for (const post of posts) {
                const { error } = await supabase.from('bw_posts').upsert(post, { onConflict: 'source_url' });
                if (!error) saved++;
                else console.error(`  ❌ DB Upsert Error: ${error.message}`);
            }
            console.log(`✅ Saved ${saved} items.`);
        } else {
            console.log('ℹ️ No new items to save.');
        }

    } catch (err) {
        console.error('🔴 BookEditor scraper fatal error:', err.message);
    }
}

scrapeBookEditor();
