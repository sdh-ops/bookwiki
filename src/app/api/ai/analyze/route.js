import { NextResponse } from "next/server";
import { PdfReader } from "pdfreader";
import mammoth from "mammoth";
import { analyzeAndPlanWithKimi } from "@/lib/ai/kimi";
import fs from "fs";
import path from "path";

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const cover = formData.get("cover");
    const title = formData.get("title");
    const author = formData.get("author");
    const targetAudience = formData.get("targetAudience");
    const slideCount = formData.get("slideCount");
    const snsPlatform = formData.get("snsPlatform");
    const conceptsRaw = formData.get("concepts");
    const concepts = conceptsRaw ? JSON.parse(conceptsRaw) : ['hook', 'info', 'mbti'];

    if (!file) {
      return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
    }

    // 0. 도서 표지 저장 처리 (있을 경우)
    let coverUrl = null;
    if (cover && cover.size > 0) {
      const coverBuffer = Buffer.from(await cover.arrayBuffer());
      const uploadDir = path.join(process.cwd(), "public", "uploads");
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      
      const fileName = `cover_${Date.now()}_${cover.name}`;
      const filePath = path.join(uploadDir, fileName);
      fs.writeFileSync(filePath, coverBuffer);
      coverUrl = `/uploads/${fileName}`;
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let extractedText = "";

    // 1. 파일 형식에 따른 텍스트 추출
    if (file.name.endsWith(".pdf")) {
      extractedText = await new Promise((resolve, reject) => {
        let text = "";
        new PdfReader().parseBuffer(buffer, (err, item) => {
          if (err) reject(err);
          else if (!item) resolve(text);
          else if (item.text) text += item.text + " ";
        });
      });
    } else if (file.name.endsWith(".docx")) {
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    } else if (file.name.endsWith(".txt")) {
      extractedText = buffer.toString("utf-8");
    } else {
      return NextResponse.json({ error: "지원하지 않는 파일 형식입니다." }, { status: 400 });
    }

    // 2. Kimi 2.6 통합 분석 및 기획 (DNA 추출 + 3종 기획안 생성)
    const result = await analyzeAndPlanWithKimi(extractedText, { 
      title, 
      author, 
      targetAudience,
      slideCount,
      snsPlatform,
      concepts
    });

    // 모든 기획안에 실제 표지 URL 주입
    const plansWithCover = result.plans.map(plan => ({
      ...plan,
      coverUrl: coverUrl
    }));

    return NextResponse.json({ 
      success: true, 
      plans: plansWithCover,
      analysis: result.analysis,
      fileName: file.name
    });

  } catch (error) {
    console.error("Analysis API Error:", error);
    return NextResponse.json({ error: error.message || "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
