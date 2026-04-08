"use strict";

const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const { supabase } = require('./common');

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
const LOOKBACK_DAYS = 1; // 어제($T-1$) 및 오늘의 최신 공고만 선별적으로 수집 (Today: 2026-04-08 -> Lookback: 2026-04-07)
const BE_USER = process.env.BOOKEDITOR_ID || 'sdh0815';
const BE_PASS = process.env.BOOKEDITOR_PW || 'Sk18061806!';

// Wait for CUPID challenge to resolve (Cafe24 bot protection)
async function waitForRealContent(page, timeout = 15000) {
    try {
        await page.waitForFunction(
            () => !document.querySelector('script[src*="cupid.js"]') || document.querySelector('table') !== null,
            { timeout }
        );
        // Extra wait for redirect after challenge
        await new Promise(r => setTimeout(r, 2000));
    } catch (_) {
        // Timeout - proceed anyway
    }
}

async function scrapeBookEditor() {
    console.log('🚀 Starting BookEditor scraping...');
    console.log(`📅 Current System Time: ${new Date().toLocaleString()}`);
    console.log(`⚙️ Configured Lookback Days: ${LOOKBACK_DAYS}`);
    const baseUrl = 'http://bookeditor.org';
    const posts = [];

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - LOOKBACK_DAYS);
    console.log(`📅 Dynamic Lookback: From ${startDate.toISOString().split('T')[0]}`);

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

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-extensions',
                '--disable-features=AdFilter,HttpsUpgrades',
                '--allow-running-insecure-content',
                '--disable-web-security'
            ]
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        // Navigate to main page first (triggers CUPID challenge resolution)
        console.log('🌐 Loading site...');
        try {
            await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await new Promise(r => setTimeout(r, 3000)); // Wait for CUPID redirect
        } catch (e) {
            const msg = e.message || '';
            if (msg.includes('ERR_TOO_MANY_REDIRECTS') || msg.includes('overTraffic') || msg.includes('503')) {
                console.error('  🛑 Site is over traffic limit or redirect loop (Cafe24). Aborting.');
                return;
            }
            console.warn(`  ⚠️ Main page load: ${msg}`);
        }

        // Check for Cafe24 traffic limit via URL (in case goto succeeded but landed on 503 page)
        const mainUrl = page.url();
        if (mainUrl.includes('overTraffic') || mainUrl.includes('503')) {
            console.error('  🛑 Site is over traffic limit (Cafe24 503). Aborting.');
            return;
        }

        // Login via POST form submission (direct URL approach)
        console.log('🔐 Logging in to BookEditor...');
        try {
            await page.goto(`${baseUrl}/editorplaza/sub9/blist.php?start=0`, {
                waitUntil: 'domcontentloaded', timeout: 30000
            }).catch(e => {
                if (e.message?.includes('ERR_TOO_MANY_REDIRECTS')) throw new Error('SITE_UNAVAILABLE');
                throw e;
            });
            await new Promise(r => setTimeout(r, 3000));
            const currentUrl = page.url();
            console.log('  ℹ️ Redirected to:', currentUrl);

            // If redirected to login, fill the form
            if (currentUrl.includes('login') || currentUrl.includes('Login')) {
                await page.type('input[name="id"]', BE_USER, { delay: 50 });
                await page.type('input[name="passwd"]', BE_PASS, { delay: 50 });
                await Promise.all([
                    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
                    page.click('input[type="submit"], button[type="submit"], input[type="image"]').catch(() =>
                        page.keyboard.press('Enter')
                    )
                ]);
                await new Promise(r => setTimeout(r, 2000));
            }
            console.log('  ✅ Login step complete. URL:', page.url());
        } catch (e) {
            if (e.message === 'SITE_UNAVAILABLE' || e.message?.includes('ERR_TOO_MANY_REDIRECTS')) {
                console.error('  🛑 Site unavailable (redirect loop). Aborting.');
                return;
            }
            console.warn(`  ⚠️ Login step failed: ${e.message}. Continuing...`);
        }

        // Scrape list pages
        let start = 0;
        const pageSize = 25;
        let reachedOldPosts = false;

        while (posts.length < MAX_POSTS && !reachedOldPosts) {
            const listUrl = `${baseUrl}/editorplaza/sub9/blist.php?start=${start}`;
            console.log(`\n📄 Fetching list page (start=${start})...`);

            try {
                await page.goto(listUrl, { waitUntil: 'networkidle2', timeout: 30000 });
                await waitForRealContent(page);
            } catch (e) {
                console.error(`  ❌ Failed to load list page: ${e.message}`);
                break;
            }

            const listHtml = await page.content();
            const $list = cheerio.load(listHtml);

            // Try multiple selectors
            let rows = $list('tr[bgcolor]');
            if (rows.length === 0) rows = $list('tr[onmouseover]');
            if (rows.length === 0) rows = $list('table tr').filter((_, el) =>
                $list(el).find('a[href*="id="], a[onclick*="id="]').length > 0
            );

            if (rows.length === 0) {
                console.log('⚠️ No rows found. List might be empty or selectors failed.');
                console.log(`  ℹ️ HTML preview: ${listHtml.substring(0, 400)}`);
                break;
            }
            console.log(`  ✅ Found ${rows.length} rows.`);

            for (let i = 0; i < rows.length && posts.length < MAX_POSTS; i++) {
                const el = rows[i];
                const titleLink = $list(el).find('a.board');
                const tds = $list(el).find('td');

                if (titleLink.length === 0 || tds.length < 5) continue;

                const titleText = titleLink.text().trim();
                const onclick = titleLink.attr('onclick') || '';
                const href = titleLink.attr('href') || '';
                const idMatch = (onclick + href).match(/id=(\d+)/);
                const postId = idMatch ? parseInt(idMatch[1]) : NaN;

                if (isNaN(postId)) continue;

                const detailUrl = `${baseUrl}/editorplaza/sub9/bread.php?id=${postId}&code=bepsub9&start=0`;

                if (existingUrls.has(detailUrl)) {
                    console.log(`  ⏭ Skipping (already in DB): ${titleText.substring(0, 35)}...`);
                    continue;
                }

                if (!isValidPost(titleText) || titleText.includes('공지')) continue;
                const lowerTitle = titleText.toLowerCase();
                if (lowerTitle.startsWith('re:') || lowerTitle.startsWith('re ')) continue;

                const author = $list(tds[4]).text().trim() || '익명';
                const dateText = $list(tds[2]).text().trim() || $list(tds[3]).text().trim();

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

                // Fetch detail page
                try {
                    await page.goto(detailUrl, { waitUntil: 'networkidle2', timeout: 30000 });
                    await waitForRealContent(page);

                    const detailHtml = await page.content();
                    const $ = cheerio.load(detailHtml);
                    $('script, style, link, meta, noscript').remove();

                    let content = '';

                    // Priority 1: style1 class
                    const contentTd = $('td p.style1, .style1');
                    if (contentTd.length > 0) {
                        contentTd.each((_, p) => {
                            const pHtml = $(p).html()?.trim();
                            if (pHtml && pHtml.length > content.length) content = pHtml;
                        });
                    }

                    // Priority 2: width 575/550 table
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

                    // Priority 3: Any large text block
                    if (content.length < 100) {
                        $('td').each((_, td) => {
                            const tdHtml = $(td).html()?.trim();
                            if (tdHtml && tdHtml.length > 300 && !tdHtml.includes('<table')) {
                                if (tdHtml.length > content.length) content = tdHtml;
                            }
                        });
                    }

                    if (content.length > 100) {
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
                    console.error(`  ❌ Failed detail: ${titleText.substring(0, 25)}... - ${err.message}`);
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
    } finally {
        if (browser) await browser.close();
    }
}

scrapeBookEditor();
