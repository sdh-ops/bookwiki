import puppeteer from 'puppeteer';
import fs from 'fs';

async function testRealImageRender() {
  console.log("--- 실제 배경 이미지 렌더링 테스트 시작 ---");
  
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1350 });

  // 테스트용 파라미터 (실제 배경 이미지가 들어간 URL 시뮬레이션)
  const testImageUrl = "https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&q=80&w=1080";
  const testText = "배경 이미지가\n정상적으로 출력되는지\n테스트 중입니다.";

  const htmlContent = `
    <html>
      <body style="margin:0; padding:0; background: black;">
        <div id="slide" style="width:1080px; height:1350px; position:relative; overflow:hidden; display:flex; justify-content:center; align-items:center; font-family: sans-serif;">
          <!-- 실제 배경 이미지 -->
          <img src="${testImageUrl}" style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover; filter: brightness(0.6);" />
          
          <!-- 오버레이 그라데이션 -->
          <div style="position:absolute; inset:0; background: linear-gradient(to bottom, transparent, rgba(0,0,0,0.7));"></div>

          <!-- 텍스트 -->
          <h1 style="position:relative; z-index:10; color:white; font-size:80px; text-align:center; white-space:pre-wrap; text-shadow: 0 10px 30px rgba(0,0,0,0.5);">
            ${testText}
          </h1>
        </div>
      </body>
    </html>
  `;

  await page.setContent(htmlContent);
  
  console.log("이미지 로딩 대기 중...");
  await new Promise(r => setTimeout(r, 3000)); // 이미지 로딩 시간 부여

  const element = await page.$('#slide');
  await element.screenshot({ path: 'scratch/image_test_result.png' });
  
  console.log("✅ 테스트 완료! scratch/image_test_result.png 파일을 확인해 주세요.");
  await browser.close();
}

testRealImageRender();
