"use server";

import { revalidatePath } from "next/cache";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 글 상세 캐시를 바로 비운다.
 *
 * 글 상세는 서버가 그린 HTML 을 캐시해 둔다(post/[id]/page.js 의 revalidate) — Vercel 무료 한도
 * (Fluid Active CPU 4시간)를 크롤러가 글을 하나씩 열 때마다 새로 그리느라 다 썼다(2026-10-03).
 * 그래서 글을 고치거나·지우거나·옮기거나·되살린 쪽은 저장이 끝난 뒤 이걸 불러야 한다.
 * 안 부르면 캐시가 끝날 때까지 남에게 옛 본문(또는 지운 글)이 보인다.
 *
 * 누구나 부를 수 있지만 하는 일은 「그 글을 다음 방문 때 한 번 새로 그린다」뿐이라 막지 않는다.
 */
export async function refreshPostCache(id) {
  if (typeof id !== "string" || !UUID.test(id)) return;
  revalidatePath(`/post/${id}`);
}
