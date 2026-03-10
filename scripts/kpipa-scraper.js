"use strict";

const axios = require('axios');
const cheerio = require('cheerio');
const { supabase } = require('./common');

async function scrapeKPIPA() {
    console.log('Starting KPIPA scraping...');
    const baseUrl = 'https://www.kpipa.or.kr';
    const listUrl = `${baseUrl}/info/newsNotice.do`;

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

        // Find all post links in the list
        $list('table tbody tr').each((i, row) => {
            const titleCell = $list(row).find('td.title, td:nth-child(2)');
            const link = titleCell.find('a');

            if (link.length > 0) {
                const href = link.attr('href') || link.attr('onclick');
                const title = link.text().trim();

                if (title && (title.includes('공고') || title.includes('모집') || title.includes('지원') || title.includes('사업'))) {
                    // Extract post ID from href or onclick
                    let postUrl = '';
                    if (href && href.includes('seq=')) {
                        const match = href.match(/seq=(\d+)/);
                        if (match) {
                            postUrl = `${baseUrl}/info/newsNoticeView.do?seq=${match[1]}`;
                        }
                    } else if (href && href.startsWith('/')) {
                        postUrl = `${baseUrl}${href}`;
                    } else if (href && href.startsWith('http')) {
                        postUrl = href;
                    }

                    if (postUrl) {
                        postLinks.push({ title, url: postUrl });
                    }
                }
            }
        });

        // Also try alternative list structure
        if (postLinks.length === 0) {
            $list('a').each((i, el) => {
                const href = $list(el).attr('href') || '';
                const text = $list(el).text().trim();

                if (text.length > 10 && (text.includes('공고') || text.includes('모집') || text.includes('지원'))) {
                    let postUrl = '';
                    if (href.startsWith('/')) {
                        postUrl = `${baseUrl}${href}`;
                    } else if (href.startsWith('http')) {
                        postUrl = href;
                    }

                    if (postUrl && !postLinks.find(p => p.url === postUrl)) {
                        postLinks.push({ title: text, url: postUrl });
                    }
                }
            });
        }

        console.log(`Found ${postLinks.length} potential posts from KPIPA.`);

        const posts = [];

        // Fetch each post's detail content
        for (const link of postLinks.slice(0, 20)) { // Limit to 20 posts
            try {
                console.log(`Fetching: ${link.title.substring(0, 40)}...`);

                const { data: detailHtml } = await axios.get(link.url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'text/html,application/xhtml+xml',
                        'Accept-Language': 'ko-KR,ko;q=0.9'
                    }
                });

                const $detail = cheerio.load(detailHtml);

                // Extract content from detail page
                let content = '';

                // Try various content selectors
                const contentSelectors = [
                    '.view-content',
                    '.board-view-content',
                    '.content-area',
                    '.view_content',
                    'div.content',
                    'td.content',
                    '.post-content'
                ];

                for (const selector of contentSelectors) {
                    const contentEl = $detail(selector);
                    if (contentEl.length > 0 && contentEl.text().trim().length > 50) {
                        // Convert images to absolute URLs
                        contentEl.find('img').each((j, img) => {
                            const src = $detail(img).attr('src');
                            if (src && !src.startsWith('http')) {
                                $detail(img).attr('src', `${baseUrl}${src.startsWith('/') ? '' : '/'}${src}`);
                            }
                        });
                        content = contentEl.html().trim();
                        break;
                    }
                }

                // Fallback: get main text content
                if (!content) {
                    const bodyText = $detail('body').text().replace(/\s+/g, ' ').trim();
                    if (bodyText.length > 100) {
                        content = `<p>${bodyText.substring(0, 2000)}...</p><p><a href="${link.url}" target="_blank">전체 내용 보기</a></p>`;
                    }
                }

                if (content) {
                    posts.push({
                        title: link.title,
                        source_url: link.url,
                        author: '출판진흥원',
                        board_type: 'support',
                        is_auto: true,
                        content: content
                    });
                }

                // Small delay to be polite
                await new Promise(r => setTimeout(r, 500));

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
                console.error(`Error inserting ${post.title}:`, error.message);
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
