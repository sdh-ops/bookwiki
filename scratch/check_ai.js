import { analyzeAndPlanWithKimi } from '../src/lib/ai/kimi.js';
import { generateVisualSpecWithGemini } from '../src/lib/ai/gemini.js';
import fs from 'fs';

// Simple env loader
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) env[key.trim()] = value.trim();
});

process.env.KIMI_API_KEY = env.KIMI_API_KEY;
process.env.GOOGLE_GENERATIVE_AI_API_KEY = env.GOOGLE_GENERATIVE_AI_API_KEY;

async function testFullPipeline() {
  console.log("--- 북플로우 v3.0 통합 엔진 검증 시작 ---");
  
  const testText = "이것은 테스트 원고입니다. 아름다움과 죽음의 미학을 다루는 미시마 유키오의 단편선 분석 테스트입니다.";
  const bookInfo = { title: "아름다움이 사람을 죽일 때", author: "미시마 유키오", slideCount: 4 };

  try {
    console.log("\n1. Kimi 2.6 통합 분석 및 기획 중...");
    const result = await analyzeAndPlanWithKimi(testText, bookInfo);
    console.log("✅ Kimi 응답 성공");
    console.log("첫 번째 기획안 슬라이드 샘플:", JSON.stringify(result.plans[0].slides, null, 2));

    console.log("\n2. Gemini 3.1 비주얼 명세 생성 중...");
    const visual = await generateVisualSpecWithGemini(result.plans[0], result.analysis.visualMood);
    console.log("✅ Gemini 응답 성공 (디자인 완료)");
    console.log(JSON.stringify(visual, null, 2));

    console.log("\n--- 전체 파이프라인이 정상 작동합니다! ---");
  } catch (error) {
    console.error("\n❌ 테스트 실패:", error.message);
  }
}

testFullPipeline();
