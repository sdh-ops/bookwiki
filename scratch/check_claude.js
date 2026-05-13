import { generatePlansWithClaude } from '../src/lib/ai/claude.js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) env[key.trim()] = value.trim();
});

process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;

async function testClaude() {
  console.log("--- Claude API 단독 검증 시작 ---");
  
  const mockDna = { 
    hooks: ["테스트 훅 1", "테스트 훅 2"], 
    keyPoints: ["핵심 포인트 1"], 
    visualMood: "Cinematic" 
  };

  try {
    console.log("Claude 3.5 기획 테스트 중...");
    const plans = await generatePlansWithClaude(mockDna, { title: "테스트 도서", slideCount: 4, snsPlatform: "Instagram" });
    console.log("✅ Claude 응답 성공!");
    console.log(JSON.stringify(plans, null, 2));
    console.log("\n--- Claude 서비스가 정상 작동합니다! ---");
  } catch (error) {
    console.error("\n❌ Claude 테스트 실패:", error.message);
  }
}

testClaude();
