"use strict";

const axios = require('axios');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');
const { supabase } = require('./common');
const qs = require('qs');

// Configuration from environment or user provided
const BE_USER = process.env.BOOKEDITOR_ID || 'sdh0815';
const BE_PASS = process.env.BOOKEDITOR_PW || 'Sk18061806!';

async function scrapeBookEditor() {
    console.log('Starting Advanced BookEditor scraping...');
    const baseUrl = 'http://bookeditor.org';
    const loginUrl = `${baseUrl}/login/logincheck.php`;
    const listUrl = `${baseUrl}/editorplaza/sub9/blist.php`;

    try {
        // 1. Session Login
        console.log('Attempting login...');
        const loginData = qs.stringify({
            id: BE_USER,
            passwd: BE_PASS
        });

        const loginResponse = await axios.post(loginUrl, loginData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0'
            },
            maxRedirects: 0, // Catch the redirect cookie
            validateStatus: (status) => status >= 200 && status < 400
        });

        const cookies = loginResponse.headers['set-cookie'];
        if (!cookies) {
            console.error('Login failed: No cookies received.');
            // return; // Continue anyway as some content might be public
        }
        const sessionCookie = cookies ? cookies.join('; ') : '';
        console.log('Login successful (or proceeded without cookies).');

        // 2. Fetch Listing
        const listResponse = await axios.get(listUrl, {
            responseType: 'arraybuffer',
            headers: {
                'Cookie': sessionCookie,
                'User-Agent': 'Mozilla/5.0'
            }
        });
        const listHtml = iconv.decode(Buffer.from(listResponse.data), 'euc-kr');
        const $list = cheerio.load(listHtml);
        const posts = [];

        const rows = $list('tr[bgcolor]');
        console.log(`Found ${rows.length} potential posts in listing.`);

        for (let i = 0; i < rows.length; i++) {
            const el = rows[i];
            const titleLink = $list(el).find('a.board');
            const tds = $list(el).find('td');

            if (titleLink.length > 0 && tds.length >= 5) {
                const titleText = titleLink.text().trim();
                const postIdText = $list(tds[0]).text().trim();
                const postId = parseInt(postIdText);

                if (!isNaN(postId) && !titleText.includes('공지')) {
                    const detailUrl = `${baseUrl}/editorplaza/sub9/bread.php?id=${postId}&code=bepsub9&bookid=&start=0`;
                    const author = $list(tds[4]).text().trim() || '익명업체';

                    // 3. Fetch Detail for each post
                    console.log(`Processing detail for: ${titleText} (${postId})`);
                    try {
                        const detailResponse = await axios.get(detailUrl, {
                            responseType: 'arraybuffer',
                            headers: {
                                'Cookie': sessionCookie,
                                'User-Agent': 'Mozilla/5.0'
                            }
                        });
                        const detailHtml = iconv.decode(Buffer.from(detailResponse.data), 'euc-kr');
                        const $detail = cheerio.load(detailHtml);

                        // Extract content from detail page
                        // Usually post body is in a table cell with specific valign or width
                        let content = '';
                        const contentCell = $detail('td[valign="top"]').first();

                        if (contentCell.length > 0) {
                            // Convert relative images to absolute
                            contentCell.find('img').each((j, img) => {
                                const src = $detail(img).attr('src');
                                if (src && !src.startsWith('http')) {
                                    $detail(img).attr('src', `${baseUrl}/editorplaza/sub9/${src.replace(/^\.\//, '')}`);
                                }
                            });

                            // Extract text and images as HTML or enhanced Markdown
                            content = contentCell.html().trim();
                        } else {
                            content = `내용을 가져올 수 없습니다. 원본 링크를 확인해 주세요.\n\n원본 출처: ${detailUrl}`;
                        }

                        // Extract attachments
                        const attachments = [];
                        $detail('a[href*="download.php"], img[src*="file.gif"]').each((j, att) => {
                            const link = $detail(att).is('a') ? $detail(att).attr('href') : $detail(att).closest('a').attr('href');
                            if (link) {
                                attachments.push(`${baseUrl}/editorplaza/sub9/${link.replace(/^\.\//, '')}`);
                            }
                        });

                        if (attachments.length > 0) {
                            content += `\n\n### 첨부파일\n${attachments.map(a => `- [파일 다운로드](${a})`).join('\n')}`;
                        }

                        posts.push({
                            title: titleText,
                            source_url: detailUrl,
                            author: author,
                            board_type: 'job',
                            is_auto: true,
                            content: content
                        });
                    } catch (detailErr) {
                        console.error(`Failed to fetch detail for ${postId}:`, detailErr.message);
                    }
                }
            }
            // Limit to top 5 for testing to avoid overwhelming
            if (posts.length >= 10) break;
        }

        console.log(`Scraped ${posts.length} full posts. Syncing to database...`);

        for (const post of posts) {
            const { error } = await supabase
                .from('bw_posts')
                .upsert(post, { onConflict: 'source_url' });

            if (error && error.code !== '23505') {
                console.error(`Error inserting ${post.title}:`, error.message);
            }
        }

        await cleanupOldPosts();

        console.log('Advanced BookEditor scraping finished.');

    } catch (err) {
        console.error('BookEditor scraping failed:', err.message);
    }
}

async function cleanupOldPosts() {
    console.log('Cleaning up old automated posts (keeping latest 200)...');
    try {
        const { data: posts } = await supabase
            .from('bw_posts')
            .select('created_at')
            .eq('board_type', 'job')
            .eq('is_auto', true)
            .order('created_at', { ascending: false })
            .range(199, 199);

        if (posts && posts.length > 0) {
            const cutOffDate = posts[0].created_at;
            const { error: deleteError } = await supabase
                .from('bw_posts')
                .delete()
                .eq('board_type', 'job')
                .eq('is_auto', true)
                .lt('created_at', cutOffDate);

            if (deleteError) console.error('Cleanup error:', deleteError.message);
            else console.log(`Deleted posts older than ${cutOffDate}`);
        }
    } catch (err) {
        console.error('Cleanup failed:', err.message);
    }
}

scrapeBookEditor();
