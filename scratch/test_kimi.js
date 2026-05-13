const fs = require('fs');
const path = require('path');
const axios = require('axios');

function getApiKey() {
  const envPath = path.join(process.cwd(), '.env.local');
  const content = fs.readFileSync(envPath, 'utf8');
  const match = content.match(/KIMI_API_KEY=(.*)/);
  return match ? match[1].trim() : null;
}

async function testKimi() {
  const KIMI_API_KEY = getApiKey();
  console.log("Using API Key:", KIMI_API_KEY ? "Exists" : "Missing");

  try {
    const response = await axios.post(
      'https://api.moonshot.ai/v1/chat/completions',
      {
        model: 'kimi-k2.6',
        messages: [
          { role: 'system', content: '도서 마케팅 및 디자인 디렉터입니다. 창의적이고 정확한 JSON을 출력합니다.' },
          { role: 'user', content: '도서 "테스트 도서"에 대한 카드뉴스 기획안을 JSON 형식으로 3가지 생성해줘. 각 기획안은 title, strategy, tags, previewText, slides를 포함해야 해.' }
        ],
        temperature: 1,
        response_format: { type: "json_object" }
      },
      {
        headers: { 'Authorization': `Bearer ${KIMI_API_KEY}`, 'Content-Type': 'application/json' },
        timeout: 30000 
      }
    );
    console.log("Response Status:", response.status);
    console.log("Response Content:", response.data.choices[0].message.content);
  } catch (error) {
    if (error.response) {
      console.error("Error Status:", error.response.status);
      console.error("Error Data:", JSON.stringify(error.response.data, null, 2));
    } else {
      console.error("Error Message:", error.message);
    }
  }
}

testKimi();
