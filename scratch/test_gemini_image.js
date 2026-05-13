import axios from 'axios';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) env[key.trim()] = value.trim();
});
const KEY = env.GOOGLE_GENERATIVE_AI_API_KEY;

async function testImageGeneration() {
  console.log("--- Gemini Imagen 4.0 이미지 생성 테스트 ---");
  
  try {
    // Note: The actual endpoint for Imagen via Gemini API might vary by version
    // Usually it's models/imagen-3:predict or similar, but for 4.0 we'll try the generateContent style or predict
    const prompt = "A cinematic, moody, dark academy style library with a single red rose on a black desk, high contrast, professional photography, 4k";
    
    console.log("이미지 생성 중... (약 10-20초 소요)");
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-fast-generate-001:predict?key=${KEY}`,
      {
        instances: [{ prompt: prompt }],
        parameters: { sampleCount: 1 }
      }
    );

    if (res.data.predictions && res.data.predictions[0].bytesBase64Encoded) {
      console.log("✅ 이미지 생성 성공!");
      fs.writeFileSync('scratch/gemini_test_image.png', Buffer.from(res.data.predictions[0].bytesBase64Encoded, 'base64'));
      console.log("결과물이 scratch/gemini_test_image.png 에 저장되었습니다.");
    } else {
      console.log("❌ 응답 데이터 구조가 예상과 다릅니다:", JSON.stringify(res.data).substring(0, 500));
    }
  } catch (e) {
    console.log(`❌ 생성 실패: ${e.response?.data?.error?.message || e.message}`);
    console.log("세부사항:", JSON.stringify(e.response?.data));
  }
}

testImageGeneration();
