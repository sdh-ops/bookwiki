import "server-only";
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { POST_COLUMNS } from "@/lib/columns";

export const SITE_URL = "https://www.bookwiki.co.kr";

// 서버에서 공개 글을 읽는 용도. 세션을 저장하지 않는다(요청마다 새 익명 클라이언트).
function serverSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// generateMetadata 와 페이지가 같은 요청에서 두 번 부르므로 cache 로 한 번만 조회한다
export const getPublicPost = cache(async (id) => {
  const { data, error } = await serverSupabase().from("bw_posts").select(POST_COLUMNS).eq("id", id).maybeSingle();
  if (error) {
    // 잘못된 id(uuid 형식 아님)도 여기로 온다 — 없는 글로 취급
    if (error.code !== "22P02") console.error("[post] load:", error.message);
    return null;
  }
  return data;
});

/** 같은 게시판의 바로 앞(더 오래된)·뒤(더 최근) 글 */
export async function getNeighborPosts(post) {
  const supabase = serverSupabase();
  const base = () =>
    supabase.from("bw_posts").select("id, title").eq("board_type", post.board_type).eq("is_deleted", false);
  const [older, newer] = await Promise.all([
    base().lt("created_at", post.created_at).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    base().gt("created_at", post.created_at).order("created_at", { ascending: true }).limit(1).maybeSingle(),
  ]);
  if (older.error) console.error("[post] older:", older.error.message);
  if (newer.error) console.error("[post] newer:", newer.error.message);
  return { older: older.data || null, newer: newer.data || null };
}

const ENTITIES = { "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&#x27;": "'" };

/** 본문 HTML → 공유 미리보기용 한두 줄 */
export function summarizeHtml(html, max = 150) {
  if (!html) return "";
  const text = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d)>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, (m) => ENTITIES[m] ?? " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** 공유 미리보기 그림 — 본문 첫 그림, 없으면 첨부 그림 (https 절대주소만) */
export function firstImageUrl(post) {
  const fromContent = post.content?.match(/<img[^>]+src=["'](https:\/\/[^"']+)["']/i)?.[1];
  if (fromContent) return fromContent;
  const attached = (post.attachments || []).find((a) => a?.type?.startsWith("image/") && a.url?.startsWith("https://"));
  return attached?.url || null;
}

/**
 * 사이트맵에 실을 공개 글 전부 (id, created_at).
 *
 * ⛔ 한 번의 select 로 끝내지 마라. Supabase 는 요청당 행 수에 상한(기본 1000)이 있어서
 * 글이 그만큼 늘면 뒷글이 조용히 빠진다 — 사이트맵은 빠진 걸 아무도 못 알아챈다.
 * 1000개씩 끊어 받고, 받은 게 한 장보다 적으면 그게 마지막 장이다.
 */
export async function getSitemapPosts() {
  const supabase = serverSupabase();
  const PAGE = 1000;
  const posts = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("bw_posts")
      .select("id, created_at")
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) {
      // 사이트맵은 비어서 나가면 안 된다 — 여기까지 받은 건 살리고 이유를 남긴다
      console.error("[sitemap] posts:", error.message);
      break;
    }
    posts.push(...data);
    if (data.length < PAGE) break;
  }
  return posts;
}
