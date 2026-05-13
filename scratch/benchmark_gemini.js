import axios from 'axios';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) env[key.trim()] = value.trim();
});
const KEY = env.GOOGLE_GENERATIVE_AI_API_KEY;

const models = [
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview',
  'gemini-2.5-flash'
];

async function testPricePerformance() {
  console.log("--- Gemini 가성비 모델 벤치마크 시작 ---");
  
  for (const model of models) {
    console.log(`\n[테스트 모델: ${model}]`);
    const start = Date.now();
    try {
      const res = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${KEY}`,
        {
          contents: [{ parts: [{ text: "카드뉴스 디자인을 위한 '미니멀리즘' 색상 팔레트 3개를 JSON으로 제안해줘." }] }]
        }
      );
      const end = Date.now();
      console.log(`✅ 성공! (소요시간: ${end - start}ms)`);
      console.log("응답 요약:", res.data.candidates[0].content.parts[0].text.substring(0, 100) + "...");
    } catch (e) {
      console.log(`❌ 실패: ${e.response?.data?.error?.message || e.message}`);
    }
  }
}

testPricePerformance();
