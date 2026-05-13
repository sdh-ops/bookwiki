import puppeteer from 'puppeteer';

async function diagnoseImageLoading() {
  console.log("--- 🔍 배경 이미지 로딩 정밀 진단 시작 ---");
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-web-security']
  });
  
  const page = await browser.newPage();
  
  // 실제 사람처럼 보이게 User-Agent 설정
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  // 모든 네트워크 요청 모니터링
  page.on('request', request => {
    if (request.resourceType() === 'image') {
      console.log(`[Image Request] URL: ${request.url().substring(0, 80)}...`);
    }
  });

  page.on('requestfinished', request => {
    if (request.resourceType() === 'image') {
      console.log(`✅ [Success] Image loaded: ${request.url().substring(0, 80)}...`);
    }
  });

  page.on('requestfailed', request => {
    if (request.resourceType() === 'image') {
      console.log(`❌ [Failed] Image failed: ${request.url().substring(0, 80)}... Error: ${request.failure().errorText}`);
    }
  });

  // 테스트할 실제 렌더링 URL (로컬 서버가 켜져 있어야 함)
  const testUrl = "http://localhost:3000/render-slide?text=배경+로딩+테스트&visualTheme=mystery&imagePrompt=dark+moody+library";
  
  try {
    console.log(`페이지 접속 중: ${testUrl}`);
    await page.goto(testUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // 3초 대기 후 캡처
    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({ path: 'scratch/diagnostic_result.png' });
    
    console.log("--- 진단 완료! scratch/diagnostic_result.png 확인 요망 ---");
  } catch (err) {
    console.error("❌ 진단 중 오류 발생:", err.message);
  } finally {
    await browser.close();
  }
}

diagnoseImageLoading();
