import { supabase } from "./supabase";

/**
 * 게시판 말머리(카테고리) 조회.
 *
 * 스폰서 말머리(예: 한겨레교육)는 해당 광고주의 배너가 게재중일 때만 반환된다.
 * 판정은 서버(get_visible_post_categories RPC)가 단독으로 하므로,
 * 화면 쪽에서 광고 게재 여부를 다시 따지지 않는다.
 */
// RPC 가 아직 없거나(마이그레이션 전) 조회에 실패했을 때 쓰는 최소 말머리.
// 이게 없으면 톡톡 글쓰기가 "말머리를 선택해주세요"에서 막혀 버린다.
const FALLBACK = {
  free: ["잡담", "후기", "모집"],
};

function fallbackFor(boardType) {
  return (FALLBACK[boardType] || []).map((label, i) => ({
    label,
    sort_order: i + 1,
    sponsor_advertiser: null,
    is_sponsored: false,
  }));
}

export async function fetchVisibleCategories(boardType = "free") {
  const { data, error } = await supabase.rpc("get_visible_post_categories", {
    p_board_type: boardType,
  });
  if (error) {
    console.error("[postCategories] load error:", error.message);
    return fallbackFor(boardType);
  }
  // 관리자가 말머리를 전부 비활성화한 상태와 RPC 실패를 구분할 수 없으므로,
  // 빈 배열이면 기본 말머리로 되돌려 글쓰기가 막히지 않게 한다.
  return data?.length ? data : fallbackFor(boardType);
}

/**
 * 제목에서 말머리를 뽑아낸다. 말머리는 '[잡담] 제목' 형태로 제목 앞에 저장된다.
 *
 * 앞머리 매칭을 우선하되, 과거 글 호환을 위해 제목 어디에 있든 찾는 방식도 남겨둔다.
 * labels 에 없는 대괄호(예: '[2026 출판유통통합전산망]')는 말머리로 보지 않는다.
 */
export function extractCategory(title, labels) {
  if (!title || !labels?.length) return null;

  const head = title.match(/^\s*\[([^\]]+)\]/);
  if (head && labels.includes(head[1])) return head[1];

  return labels.find((label) => title.includes(`[${label}]`)) || null;
}
