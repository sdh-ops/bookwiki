import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * 서버 API 문지기 — 로그인한 사람만 통과시킨다.
 *
 * 브라우저가 `Authorization: Bearer <access_token>` 를 실어 보내면 Supabase 에 그 토큰이 누구인지 묻는다.
 * AI 허브 API(analyze·render·upload)는 유료 AI 키와 서버 브라우저(Puppeteer)를 써서
 * 아무나 부르면 Vercel 무료 CPU 한도와 AI 요금이 깎인다(2026-10-19 한도 통보 점검).
 *
 * 반환: 통과하면 { user }, 막히면 { response } — 라우트는 response 를 그대로 돌려준다.
 */
export async function requireUser(req) {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    return { response: NextResponse.json({ success: false, error: "로그인 후 이용할 수 있습니다." }, { status: 401 }) };
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return { response: NextResponse.json({ success: false, error: "로그인이 만료되었습니다. 다시 로그인해 주세요." }, { status: 401 }) };
  }
  return { user: data.user };
}

