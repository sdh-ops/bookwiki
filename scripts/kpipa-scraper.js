"use strict";

const cheerio = require('cheerio');
const { supabase } = require('./common');
const pdf = require('pdf-parse');
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
const LOOKBACK_DAYS = 45; // Look back 45 days dynamically

async function scrapeKPIPA() {
    console.log('🚀 Starting KPIPA scraping...');
    const baseUrl = 'https://www.kpipa.or.kr';
    const posts = [];
    let page = 1;
    let reachedOldPosts = false;

    // Calculate dynamic START_DATE
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - LOOKBACK_DAYS);
    console.log(`📅 Dynamic Lookback: From ${startDate.toISOString().split('T')[0]}`);

    try {
        // DB Pre-check: Fetch existing source_urls to avoid redundant detail fetches
        console.log('🔍 Fetching existing posts from DB for deduplication...');
        const { data: existingPosts, error: dbError } = await supabase
            .from('bw_posts')
            .select('source_url')
            .eq('board_type', 'support')
            .eq('is_auto', true);

        if (dbError) throw new Error(`DB Fetch failed: ${dbError.message}`);
        const existingUrls = new Set(existingPosts?.map(p => p.source_url) || []);
        console.log(`✅ Loaded ${existingUrls.size} existing URLs.`);

        while (posts.length < MAX_POSTS && !reachedOldPosts) {
            const listUrl = `${baseUrl}/p/g1_2?page=${page}`;
            console.log(`\n📄 Fetching list page ${page}...`);

            const listResponse = await fetchWithRetry(listUrl);
            const $list = cheerio.load(listResponse.data);
            const postLinks = [];

            $list('a').each((_, el) => {
                const href = $list(el).attr('href') || '';
                const text = $list(el).text().trim();
                
                // Matches pattern like /p/g1_2/2034
                if (href.match(/\/p\/g1_2\/\d+/) && text.length > 5 && isValidPost(text)) {
                    const fullUrl = href.startsWith('http') ? href : `${baseUrl}${href}`;
                    if (!postLinks.find(p => p.url === fullUrl)) {
                        postLinks.push({ title: text, url: fullUrl });
                    }
                }
            });

            if (postLinks.length === 0) {
                console.log('⚠️ No more post links found on this page.');
                break;
            }

            for (const link of postLinks) {
                if (posts.length >= MAX_POSTS) break;

                // Pre-check skip
                if (existingUrls.has(link.url)) {
                    console.log(`  ⏭ Skipping (already in DB): ${link.title.substring(0, 35)}...`);
                    // We don't stop here because list might not be strictly sorted or new ones might be inserted
                    continue;
                }

                try {
                    const detailResponse = await fetchWithRetry(link.url);
                    const $ = cheerio.load(detailResponse.data);

                    // Extract date
                    const pageText = $('body').text();
                    let postDate = null;
                    const dateMatch = pageText.match(/작성일\s*(\d{2})\.(\d{2})\.(\d{2})/);
                    if (dateMatch) {
                        postDate = new Date(2000 + parseInt(dateMatch[1]), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[3]));
                    }

                    if (postDate && postDate < startDate) {
                        console.log(`  ⏭ Skipping (too old: ${postDate.toISOString().split('T')[0]}): ${link.title.substring(0, 30)}...`);
                        reachedOldPosts = true;
                        continue;
                    }

                    // Filtering
                    const titleLower = link.title.toLowerCase();
                    if (titleLower.startsWith('re:') || titleLower.startsWith('re ')) {
                        continue;
                    }
                    if (link.title.includes('공지')) {
                        continue;
                    }

                    // Remove noise
                    $('script, style, noscript').remove();

                    let contentParts = [];
                    let deadline = null;

                    // 1. Extract deadline from period info
                    const periodMatch = pageText.match(/기간\s*[:\s]*(\d{4}[-.]?\d{1,2}[-.]?\d{1,2})\s*[~-]\s*(\d{4}[-.]?\d{1,2}[-.]?\d{1,2})/);
                    if (periodMatch) {
                        deadline = periodMatch[2].replace(/\./g, '-');
                    }

                    // 2. Main content extraction
                    const mainContent = $('#bo_v_con').length > 0 ? $('#bo_v_con') : $('section#bo_v_atc, #bo_v_atc');
                    if (mainContent.length > 0) {
                        mainContent.find('iframe, embed, object, #toolbarViewer, #bo_v_atc_title, h2').remove();

                        // Fix relative URLs
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

                    // 3. Attachments & PDF Preview
                    const files = [];
                    let previewUrl = null;
                    const fileSection = $('#bo_v_file, section#bo_v_file');
                    if (fileSection.length > 0) {
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

                        const bestPreviewFile = files.find(f => f.isPdf) || files.find(f => f.name.match(/\.(docx?|xlsx?|hwp)(\s*\(.*\))?$/i));
                        if (bestPreviewFile) {
                            if (bestPreviewFile.isPdf) {
                                previewUrl = `https://www.kpipa.or.kr/p/js/pdf/web/viewer.html?file=${encodeURIComponent(bestPreviewFile.url)}`;
                            } else {
                                previewUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(bestPreviewFile.url)}`;
                            }
                        }

                        // Add Image Previews
                        files.filter(f => f.name.match(/\.(png|jpe?g|gif)(\s*\(.*\))?$/i)).forEach(img => {
                            contentParts.push(`<div style="margin:20px 0;text-align:center;"><img src="${img.url}" alt="${img.name}" style="max-width:100%;height:auto;border-radius:8px;border:1px solid #eee;"></div>`);
                        });

                        // Add Attachment UI
                        if (files.length > 0) {
                            let fileHtml = '<div style="background:#e3f2fd;padding:15px;border-radius:8px;margin-top:20px;"><strong>📎 첨부파일</strong><ul style="margin:10px 0 0 0;padding-left:20px;list-style:none;">';
                            files.forEach(file => {
                                const icon = file.isPdf ? '📕' : file.name.match(/\.(png|jpe?g|gif)$/i) ? '🖼️' : '📄';
                                fileHtml += `<li style="margin:8px 0;">${icon} <a href="${file.url}" target="_blank" style="color:#1976d2;text-decoration:none;">${file.name}</a></li>`;
                            });
                            fileHtml += '</ul></div>';
                            contentParts.push(fileHtml);
                        }
                    }

                    // 4. Smart Deadline Extraction from PDF
                    if (!deadline && files.length > 0) {
                        const mainPdf = files.find(f => f.isPdf && (f.name.includes('공고') || f.name.includes('안내') || f.name.includes('모집')));
                        if (mainPdf) {
                            try {
                                console.log(`    🔍 Parsing PDF for deadline: ${mainPdf.name}...`);
                                const pdfResponse = await fetchWithRetry(mainPdf.url, { responseType: 'arraybuffer' });
                                const pdfData = await pdf(pdfResponse.data);
                                const pdfText = pdfData.text;
                                
                                const keywords = ['신청 및 접수', '공고 기간', '접수 기간', '신청 기간', '접수 기한', '모집 기간'];
                                for (const kw of keywords) {
                                    const kwIndex = pdfText.indexOf(kw);
                                    if (kwIndex !== -1) {
                                        const proximityText = pdfText.substring(kwIndex, kwIndex + 400);
                                        const pdfDateMatch = proximityText.match(/(\d{4}[\s.]*[-.]?\s*\d{1,2}[\s.]*[-.]?\s*\d{1,2})\s*[~-]\s*(\d{4}[\s.]*[-.]?\s*\d{1,2}[\s.]*[-.]?\s*\d{1,2})/);
                                        if (pdfDateMatch) {
                                            deadline = pdfDateMatch[2].replace(/[\s.]+/g, '-').replace(/-$/, '').replace(/^(\d{4})-(\d{1})-(\d+)/, '$1-0$2-$3').replace(/-(\d{1})$/, '-0$1');
                                            console.log(`    ✅ Extracted deadline: ${deadline}`);
                                            break;
                                        }
                                    }
                                }
                            } catch (pdfErr) {
                                console.warn(`    ⚠️ PDF parsing failed: ${pdfErr.message}`);
                            }
                        }
                    }

                    if (deadline) {
                        contentParts.unshift(`<div style="background:#fff3cd;border:1px solid #ffc107;padding:12px 15px;margin-bottom:20px;border-radius:8px;"><strong>📅 마감일:</strong> ${deadline}</div>`);
                    }

                    let content = contentParts.join('\n').trim();
                    if (content.length > 50) {
                        posts.push({
                            title: link.title.replace(/새글$/, '').trim(),
                            source_url: link.url,
                            author: '출판진흥원',
                            board_type: 'support',
                            is_auto: true,
                            content: content,
                            deadline: deadline || null,
                            preview_url: previewUrl
                        });
                        console.log(`  [${posts.length}] ✓ ${link.title.substring(0, 40)}... (${content.length} chars)`);
                    }

                    await new Promise(r => setTimeout(r, 300));
                } catch (err) {
                    console.error(`  ❌ Failed detail: ${link.title.substring(0, 30)}... - ${err.message}`);
                }
            }

            page++;
            if (page > 15) break; 
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
        console.error('🔴 KPIPA scraper fatal error:', err.message);
    }
}

scrapeKPIPA();
