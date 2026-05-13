import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

/**
 * Dedicated Upload API for Background Images & Assets
 */
export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    
    // Ensure directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    const fileName = `bg_${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const filePath = path.join(uploadDir, fileName);
    
    fs.writeFileSync(filePath, buffer);
    const url = `/uploads/${fileName}`;

    console.log("✅ File uploaded successfully:", url);

    return NextResponse.json({ 
      success: true, 
      url: url 
    });

  } catch (error) {
    console.error("Upload API Error:", error);
    return NextResponse.json({ error: "파일 업로드 중 오류가 발생했습니다." }, { status: 500 });
  }
}
