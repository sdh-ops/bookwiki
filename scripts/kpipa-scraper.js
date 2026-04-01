"use strict";

const axios = require('axios');
const cheerio = require('cheerio');
const { supabase } = require('./common');

const MAX_POSTS = 100;
const START_DATE = new Date('2026-03-01');

async function scrapeKPIPA() {
    console.log('Starting KPIPA scraping...');
    const baseUrl = 'https://www.kpipa.or.kr';
    const posts = [];
    let page = 1;
    let reachedOldPosts = false;

    try {
        while (posts.length < MAX_POSTS && !reachedOldPosts) {
            const listUrl = `${baseUrl}/p/g1_2?page=${page}`;
            console.log(`Fetching page ${page}...`);

            const { data: listHtml } = await axios.get(listUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'ko-KR,ko;q=0.9' }
            });

            const $list = cheerio.load(listHtml);
            const postLinks = [];

            $list('a').each((_, el) => {
                const href = $list(el).attr('href') || '';
                const text = $list(el).text().trim();
                if (href.match(/\/p\/g1_2\/\d+/) && text.length > 5) {
                    const fullUrl = href.startsWith('http') ? href : `${baseUrl}${href}`;
                    if (!postLinks.find(p => p.url === fullUrl)) {
                        postLinks.push({ title: text, url: fullUrl });
                    }
                }
            });

            if (postLinks.length === 0) break;

            for (const link of postLinks) {
                if (posts.length >= MAX_POSTS) break;
                if (posts.find(p => p.source_url === link.url)) continue;

                try {
                    const { data: detailHtml } = await axios.get(link.url, {
                        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'ko-KR,ko;q=0.9' }
                    });

                    const $ = cheerio.load(detailHtml);

                    // Extract date
                    const pageText = $('body').text();
                    let postDate = null;
                    const dateMatch = pageText.match(/작성일\s*(\d{2})\.(\d{2})\.(\d{2})/);
                    if (dateMatch) {
                        postDate = new Date(2000 + parseInt(dateMatch[1]), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[3]));
                    }

                    if (postDate && postDate < START_DATE) {
                        console.log(`  ⏭ Skipping old post: ${link.title.substring(0, 30)}...`);
                        reachedOldPosts = true;
                        continue;
                    }

                    // RE: 제목 필터링 (답글 제외)
                    const titleLower = link.title.toLowerCase();
                    if (titleLower.startsWith('re:') || titleLower.startsWith('re ')) {
                        console.log(`  ⏭ Skipping RE: ${link.title.substring(0, 30)}...`);
                        continue;
                    }

                    // 공지 제외
                    if (link.title.includes('공지')) {
                        console.log(`  ⏭ Skipping notice: ${link.title.substring(0, 30)}...`);
                        continue;
                    }

                    // Remove scripts/styles
                    $('script, style, noscript').remove();

                    // Build content parts
                    let contentParts = [];

                    // 1. Extract deadline from period info
                    let deadline = null;
                    const periodMatch = pageText.match(/기간\s*[:\s]*(\d{4}[-.]?\d{2}[-.]?\d{2})\s*[~-]\s*(\d{4}[-.]?\d{2}[-.]?\d{2})/);
                    if (periodMatch) {
                        deadline = periodMatch[2].replace(/\./g, '-');
                        contentParts.push(`<div style="background:#fff3cd;border:1px solid #ffc107;padding:12px 15px;margin-bottom:20px;border-radius:8px;"><strong>📅 마감일:</strong> ${deadline}</div>`);
                    }

                    // 3. Get main content from #bo_v_con
                    const mainContent = $('#bo_v_con');
                    if (mainContent.length > 0) {
                        mainContent.find('iframe, embed, object, #toolbarViewer').remove();

                        // Fix URLs
                        mainContent.find('a').each((_, a) => {
                            const href = $(a).attr('href');
                            if (href && !href.startsWith('http') && !href.startsWith('#')) {
                                $(a).attr('href', `${baseUrl}${href.startsWith('/') ? '' : '/'}${href}`);
                            }
                        });
                        mainContent.find('img').each((_, img) => {
                            const src = $(img).attr('src');
                            if (src && !src.startsWith('http')) {
                                $(img).attr('src', `${baseUrl}${src.startsWith('/') ? '' : '/'}${src}`);
                            }
                        });

                        const mainHtml = mainContent.html()?.trim();
                        if (mainHtml && mainHtml.length > 20) {
                            contentParts.push(`<div style="line-height:1.8;margin-bottom:20px;">${mainHtml}</div>`);
                        }
                    }

                    // 4. Fallback to section#bo_v_atc if needed
                    if (contentParts.length < 2) {
                        const atcSection = $('section#bo_v_atc, #bo_v_atc');
                        if (atcSection.length > 0) {
                            atcSection.find('#bo_v_atc_title, h2, iframe').remove();
                            const atcHtml = atcSection.html()?.trim();
                            if (atcHtml && atcHtml.length > 30) {
                                contentParts.push(`<div style="line-height:1.8;margin-bottom:20px;">${atcHtml}</div>`);
                            }
                        }
                    }

                    // 5. Get attachments and PDF viewers from #bo_v_file
                    const fileSection = $('#bo_v_file, section#bo_v_file');
                    if (fileSection.length > 0) {
                        const files = [];
                        const pdfViewers = [];

                        // Extract PDF viewer iframes
                        fileSection.find('iframe').each((_, iframe) => {
                            const src = $(iframe).attr('src');
                            if (src && src.includes('viewer.html?file=')) {
                                pdfViewers.push(src);
                            }
                        });

                        // Extract file download links
                        fileSection.find('a').each((_, a) => {
                            const href = $(a).attr('href');
                            const text = $(a).text().trim();
                            if (href && text && (text.match(/\.(pdf|hwp|zip|docx?|xlsx?)$/i) || href.includes('/download/'))) {
                                const fullHref = href.startsWith('http') ? href : `${baseUrl}${href}`;
                                const fileName = text.replace(/\s+/g, ' ').trim();
                                if (fileName.length > 3 && !files.find(f => f.name === fileName)) {
                                    const isPdf = fileName.toLowerCase().includes('.pdf');
                                    files.push({ name: fileName, url: fullHref, isPdf });
                                }
                            }
                        });

                        // Add PDF viewer embeds
                        if (pdfViewers.length > 0) {
                            for (const viewerUrl of pdfViewers) {
                                contentParts.push(`<div style="margin:20px 0;border:1px solid #ddd;border-radius:8px;overflow:hidden;"><iframe src="${viewerUrl}" style="width:100%;height:600px;border:none;" allowfullscreen></iframe></div>`);
                            }
                        }

                        // Add Image Previews
                        const imageFiles = files.filter(f => f.name.match(/\.(png|jpe?g|gif)(\s*\(.*\))?$/i));
                        if (imageFiles.length > 0) {
                            for (const img of imageFiles) {
                                contentParts.push(`<div style="margin:20px 0;text-align:center;"><img src="${img.url}" alt="${img.name}" style="max-width:100%;height:auto;border-radius:8px;border:1px solid #eee;"></div>`);
                            }
                        }

                        // Add Office Docs Previews (Word, Excel, HWP)
                        const officeFiles = files.filter(f => f.name.match(/\.(docx?|xlsx?|hwp)(\s*\(.*\))?$/i));
                        if (officeFiles.length > 0) {
                            for (const doc of officeFiles) {
                                // Using Microsoft Office Viewer for online preview
                                const viewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(doc.url)}`;
                                contentParts.push(`<div style="margin:200px 0 20px 0;border:1px solid #ddd;border-radius:8px;overflow:hidden;"><div style="background:#f1f3f4;padding:8px 12px;font-size:12px;border-bottom:1px solid #ddd;color:#5f6368;">📄 <strong>미리보기:</strong> ${doc.name}</div><iframe src="${viewerUrl}" style="width:100%;height:600px;border:none;" allowfullscreen></iframe></div>`);
                            }
                        }

                        // Add file download links
                        if (files.length > 0) {
                            let fileHtml = '<div style="background:#e3f2fd;padding:15px;border-radius:8px;margin-top:20px;"><strong>📎 첨부파일</strong><ul style="margin:10px 0 0 0;padding-left:20px;list-style:none;">';
                            for (const file of files) {
                                const icon = file.isPdf ? '📕' : file.name.match(/\.(png|jpe?g|gif)$/i) ? '🖼️' : '📄';
                                fileHtml += `<li style="margin:8px 0;">${icon} <a href="${file.url}" target="_blank" style="color:#1976d2;text-decoration:none;">${file.name}</a></li>`;
                            }
                            fileHtml += '</ul></div>';
                            contentParts.push(fileHtml);
                        }
                    }

                    let content = contentParts.join('\n')
                        .replace(/<script[\s\S]*?<\/script>/gi, '')
                        .replace(/<style[\s\S]*?<\/style>/gi, '')
                        .trim();

                    if (content.length > 50) {
                        posts.push({
                            title: link.title.replace(/새글$/, '').trim(),
                            source_url: link.url,
                            author: '출판진흥원',
                            board_type: 'support',
                            is_auto: true,
                            content: content
                        });
                        console.log(`[${posts.length}/${MAX_POSTS}] ✓ ${link.title.substring(0, 40)}... (${content.length} chars)`);
                    }

                    await new Promise(r => setTimeout(r, 200));
                } catch (err) {
                    console.error(`Failed: ${link.title.substring(0, 30)}... - ${err.message}`);
                }
            }

            page++;
            if (page > 20) break;
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
        console.error('KPIPA scraping failed:', err.message);
    }
}

scrapeKPIPA();
