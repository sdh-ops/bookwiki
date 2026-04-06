import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";

// 서버 사이드에서 Supabase 직접 접근
const getSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

// 날짜+카테고리 조합별로 1시간 캐싱 (베스트셀러는 하루 1회 업데이트)
const fetchBestsellerData = unstable_cache(
  async (category, date) => {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("bw_bestseller_snapshots")
      .select(`
        rank,
        rank_change,
        sales_point,
        platform,
        snapshot_date,
        is_ebook,
        bw_books!inner (
          id,
          isbn,
          title,
          author,
          publisher,
          cover_url,
          description,
          pub_date
        )
      `)
      .eq("period_type", "daily")
      .eq("common_category", category)
      .eq("snapshot_date", date)
      .order("rank", { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  },
  ["bestseller-snapshots"],
  { revalidate: 3600 } // 1시간 캐시
);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") || "종합";
  const date = searchParams.get("date");

  if (!date) {
    return NextResponse.json({ error: "date 파라미터가 필요합니다" }, { status: 400 });
  }

  try {
    const data = await fetchBestsellerData(category, date);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
