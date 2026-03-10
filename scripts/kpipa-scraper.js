"use strict";

const axios = require('axios');
const cheerio = require('cheerio');
const { supabase } = require('./common');

async function scrapeKPIPA() {
    console.log('Starting KPIPA scraping...');
    const baseUrl = 'https://www.kpipa.or.kr';
    const url = `${baseUrl}/p/g1_2`;

    try {
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        });
        const $ = cheerio.load(data);
        const posts = [];

        // Correct list selector: ul.bo_list li
        $('ul.bo_list li').each((i, el) => {
            const titleLink = $(el).find('a.list-subject');
            const categorySpan = $(el).find('.bo-cate-link');

            if (titleLink.length > 0) {
                const category = categorySpan.text().trim(); // e.g. [사업공고], [결과공고]
                let titleFull = titleLink.text().replace(/새글$/, '').trim();

                // If category is not in title, prepend it
                if (!titleFull.startsWith('[') && category) {
                    titleFull = `${category} ${titleFull}`;
                }

                const relativeUrl = titleLink.attr('href');
                const fullUrl = relativeUrl.startsWith('http') ? relativeUrl : `${baseUrl}${relativeUrl}`;

                // Filter for announcements
                if (category.includes('사업공고') || category.includes('기타공고') || titleFull.includes('공고')) {
                    posts.push({
                        title: titleFull,
                        source_url: fullUrl,
                        author: '진흥원알림',
                        board_type: 'support',
                        is_auto: true,
                        content: `진흥원에서 게시한 사업공고입니다. 자세한 내용은 원본 링크를 확인해 주세요.\n\n원본 출처: ${fullUrl}`
                    });
                }
            }
        });

        console.log(`Found ${posts.length} matching posts from KPIPA.`);

        for (const post of posts) {
            const { error } = await supabase
                .from('bw_posts')
                .upsert(post, { onConflict: 'source_url' });

            if (error && error.code !== '23505') {
                console.error(`Error inserting ${post.title}:`, error.message);
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
            const { error: deleteError } = await supabase
                .from('bw_posts')
                .delete()
                .eq('board_type', 'support')
                .eq('is_auto', true)
                .lt('created_at', cutOffDate);

            if (deleteError) console.error('Cleanup error:', deleteError.message);
            else console.log(`Deleted posts older than ${cutOffDate}`);
        }
    } catch (err) {
        console.error('Cleanup failed:', err.message);
    }
}

scrapeKPIPA();
