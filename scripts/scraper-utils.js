"use strict";

const axios = require('axios');

/**
 * Fetch with retry mechanism for scrapers
 * @param {string} url The URL to fetch
 * @param {object} options Axios request options
 * @param {number} retries Number of retries (default: 3)
 * @param {number} backoff Initial delay in ms (default: 1000)
 */
async function fetchWithRetry(url, options = {}, retries = 3, backoff = 1000) {
    const timeout = options.timeout || 15000; // 15s default timeout
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        ...options.headers
    };

    for (let i = 0; i <= retries; i++) {
        try {
            const response = await axios({
                url,
                ...options,
                headers,
                timeout
            });
            return response;
        } catch (err) {
            const isLastAttempt = i === retries;
            const status = err.response?.status;

            // Don't retry on certain statuses
            if (status === 404 || status === 401 || status === 403) {
                console.error(`  ❌ [${status}] Fatal error for ${url}`);
                throw err;
            }

            // Detect Cafe24 Traffic Limit
            if (status === 503 || (err.response?.data?.includes && err.response.data.includes('접속하신 사이트는 허용 접속량을 초과하였습니다'))) {
                console.error(`  🚨 [503] Traffic Limit Exceeded for ${url}`);
                throw new Error('TRAFFIC_LIMIT_EXCEEDED');
            }

            if (isLastAttempt) {
                console.error(`  ❌ Failed to fetch ${url} after ${retries + 1} attempts: ${err.message}`);
                throw err;
            }

            const delay = backoff * Math.pow(2, i);
            console.warn(`  ⚠️ Attempt ${i + 1} failed: ${err.message}. Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

module.exports = { fetchWithRetry };
