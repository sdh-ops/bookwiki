import { generateVisualSpecWithGemini } from '../src/lib/ai/gemini.js';
import fs from 'fs';

// Simple env loader
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) env[key.trim()] = value.trim();
});

process.env.GOOGLE_GENERATIVE_AI_API_KEY = env.GOOGLE_GENERATIVE_AI_API_KEY;

async function testGemini() {
  console.log("--- Gemini 비주얼 엔진 직접 검증 시작 ---");
  
  const mockPlan = { 
    title: "테스트 기획", 
    strategy: "시네마틱 감성 마케팅",
    slides: [{ n: 1, text: "첫 번째 슬라이드", role: "Hook" }]
  };
  const mockMood = "Dark Cinematic Tech-Noir";

  try {
    console.log("Gemini 1.5 Flash 비주얼 명세 생성 중...");
    const spec = await generateVisualSpecWithGemini(mockPlan, mockMood);
    console.log("✅ Gemini 응답 성공!");
    console.log(JSON.stringify(spec, null, 2));
    console.log("\n--- Gemini 서비스가 정상 작동합니다! ---");
  } catch (error) {
    console.error("\n❌ Gemini 테스트 실패:", error.message);
  }
}

testGemini();
