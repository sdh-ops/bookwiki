"use strict";

const axios = require('axios');
const cheerio = require('cheerio');
const { supabase } = require('./common');

async function scrapeKPIPA() {
    console.log('Starting KPIPA scraping...');
    const baseUrl = 'https://www.kpipa.or.kr';
    const listUrl = `${baseUrl}/p/g1_2`;

    try {
        // Fetch listing page
        const { data: listHtml } = await axios.get(listUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'ko-KR,ko;q=0.9'
            }
        });

        const $list = cheerio.load(listHtml);
        const postLinks = [];

        // Find all post links - they are in table rows with links like /p/g1_2/XXXX
        $list('a').each((_, el) => {
            const href = $list(el).attr('href') || '';
            const text = $list(el).text().trim();

            // Match links like /p/g1_2/2016
            if (href.match(/\/p\/g1_2\/\d+/) && text.length > 5) {
                const fullUrl = href.startsWith('http') ? href : `${baseUrl}${href}`;

                if (!postLinks.find(p => p.url === fullUrl)) {
                    postLinks.push({ title: text, url: fullUrl });
                }
            }
        });

        console.log(`Found ${postLinks.length} posts from KPIPA.`);

        const posts = [];

        // Fetch each post's detail content
        for (const link of postLinks.slice(0, 20)) {
            try {
                console.log(`Fetching: ${link.title.substring(0, 50)}...`);

                const { data: detailHtml } = await axios.get(link.url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'text/html,application/xhtml+xml',
                        'Accept-Language': 'ko-KR,ko;q=0.9'
                    }
                });

                const $detail = cheerio.load(detailHtml);

                // Extract content - try multiple selectors
                let content = '';
                const contentSelectors = [
                    '.view-content',
                    '.board-view-content',
                    '.content-area',
                    '.view_content',
                    '.board_view',
                    'div.content',
                    '.post-body',
                    'article',
                    '.entry-content'
                ];

                for (const selector of contentSelectors) {
                    const contentEl = $detail(selector);
                    if (contentEl.length > 0 && contentEl.text().trim().length > 30) {
                        // Convert images to absolute URLs
                        contentEl.find('img').each((_, img) => {
                            const src = $detail(img).attr('src');
                            if (src && !src.startsWith('http')) {
                                $detail(img).attr('src', `${baseUrl}${src.startsWith('/') ? '' : '/'}${src}`);
                            }
                        });
                        content = contentEl.html().trim();
                        break;
                    }
                }

                // Try to find content in table structure (common in Korean sites)
                if (!content) {
                    $detail('table').each((_, table) => {
                        const tableText = $detail(table).text();
                        if (tableText.includes('내용') || tableText.includes('공고')) {
                            const rows = $detail(table).find('tr');
                            rows.each((_, row) => {
                                const cells = $detail(row).find('td');
                                if (cells.length > 0) {
                                    const cellContent = cells.last().html();
                                    if (cellContent && cellContent.length > 100) {
                                        content = cellContent.trim();
                                        return false;
                                    }
                                }
                            });
                        }
                        if (content) return false;
                    });
                }

                // Fallback: extract main body text
                if (!content || content.length < 50) {
                    // Remove header, footer, nav elements
                    $detail('header, footer, nav, script, style').remove();
                    const bodyText = $detail('body').text().replace(/\s+/g, ' ').trim();
                    if (bodyText.length > 100) {
                        content = `<p>${bodyText.substring(0, 3000)}</p>`;
                    }
                }

                if (content && content.length > 50) {
                    posts.push({
                        title: link.title,
                        source_url: link.url,
                        author: '출판진흥원',
                        board_type: 'support',
                        is_auto: true,
                        content: content
                    });
                    console.log(`✓ Got content for: ${link.title.substring(0, 40)}...`);
                } else {
                    console.log(`✗ No content found for: ${link.title.substring(0, 40)}...`);
                }

                // Delay between requests
                await new Promise(r => setTimeout(r, 300));

            } catch (detailErr) {
                console.error(`Failed to fetch ${link.title}:`, detailErr.message);
            }
        }

        console.log(`Successfully scraped ${posts.length} posts with content.`);

        // Save to database
        for (const post of posts) {
            const { error } = await supabase
                .from('bw_posts')
                .upsert(post, { onConflict: 'source_url' });

            if (error && error.code !== '23505') {
                console.error(`DB Error for ${post.title}:`, error.message);
            } else {
                console.log(`Saved: ${post.title.substring(0, 40)}...`);
            }
        }

        await cleanupOldPosts();
        console.log('KPIPA scraping finished.');

    } catch (err) {
        console.error('KPIPA scraping failed:', err.message);
    }
}

async function cleanupOldPosts() {
    console.log('Cleaning up old automated posts (keeping latest 200)...');
    try {
        const { data: posts } = await supabase
            .from('bw_posts')
            .select('created_at')
            .eq('board_type', 'support')
            .eq('is_auto', true)
            .order('created_at', { ascending: false })
            .range(199, 199);

        if (posts && posts.length > 0) {
            const cutOffDate = posts[0].created_at;
            await supabase
                .from('bw_posts')
                .delete()
                .eq('board_type', 'support')
                .eq('is_auto', true)
                .lt('created_at', cutOffDate);
        }
    } catch (err) {
        console.error('Cleanup failed:', err.message);
    }
}

scrapeKPIPA();
