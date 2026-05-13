import { NextResponse } from "next/server";
import puppeteer from "puppeteer";
import { generateVisualSpecWithGemini } from "@/lib/ai/gemini";

export async function POST(req) {
  let browser = null;
  try {
    const { plan, analysis, slideIndex } = await req.json(); // slideIndex is optional

    if (!plan || !plan.slides) {
      return NextResponse.json({ error: "기획안 데이터가 부족합니다." }, { status: 400 });
    }

    // 1. Visual Spec Priority (Maximize Kimi)
    const visualSpec = await generateVisualSpecWithGemini(plan, analysis?.visualMood || "");

    // 2. Puppeteer launch (Aggressive settings for image loading)
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--allow-running-insecure-content',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    });

    const page = await browser.newPage();
    
    // Set a real-looking User-Agent to avoid bot detection from image servers
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1080, height: 1350 });

    const renderedSlides = [];
    const slidesToRender = slideIndex !== undefined 
      ? plan.slides.filter((_, i) => i === slideIndex)
      : plan.slides;

    for (const slide of slidesToRender) {
      const isLastSlide = slide.n === plan.slides.length;
      
      const imagePrompt = visualSpec.slideSpecs?.find(s => s.n === slide.n)?.imagePrompt 
                         || visualSpec.imagePrompts?.[slide.n - 1] 
                         || plan.strategy 
                         || "aesthetic book background";
      
      const host = req.headers.get('host') || 'localhost:3001';
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? process.env.NEXT_PUBLIC_SITE_URL 
        : `http://${host}`;
        
      const params = new URLSearchParams({
        n: slide.n,
        text: slide.text,
        role: slide.role,
        mainColor: visualSpec.palette?.main || "#CF5C3F",
        bgColor: visualSpec.palette?.bg || "#131316",
        style: visualSpec.style || "minimal",
        imagePrompt: imagePrompt,
        textStyle: JSON.stringify(slide.textStyle || {}),
        coverStyle: JSON.stringify(slide.coverStyle || {}),
        fontSizePx: slide.fontSizePx || 90,
        fontWeight: slide.fontWeight || 900,
        fontFamily: slide.fontFamily || "Pretendard",
        visualTheme: visualSpec.visualTheme || "",
        bgType: slide.bgType || "image",
        bgStyle: slide.bgStyle || "",
        customBgUrl: slide.customBgUrl || ""
      });

      if ((isLastSlide || slide.showCover) && plan.coverUrl) {
        params.append("coverUrl", plan.coverUrl);
        params.append("coverLayout", slide.coverLayout || "center");
      }

      // Capture logic
      await page.goto(`${baseUrl}/render-slide?${params.toString()}`, {
        waitUntil: "networkidle2",
        timeout: 60000
      });

      // Perfect Rendering Strategy: Wait longer for heavy high-res images
      await new Promise(r => setTimeout(r, 6000));

      const slideElement = await page.waitForSelector("#slide-container");
      const screenshot = await slideElement.screenshot({ encoding: "base64" });
      renderedSlides.push(`data:image/png;base64,${screenshot}`);
    }

    await browser.close();

    return NextResponse.json({ 
      success: true, 
      images: renderedSlides,
      visualSpec
    });

  } catch (error) {
    console.error("Rendering API Error:", error);
    if (browser) await browser.close();
    return NextResponse.json({ error: error.message || "렌더링 중 오류가 발생했습니다." }, { status: 500 });
  }
}
