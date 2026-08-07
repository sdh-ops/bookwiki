-- ============================================================
-- 028_plan_placement_prices_and_category_memo.sql
-- ============================================================
-- 1) 요금제 단가를 "위치별"로 각각 지정할 수 있게 한다.
--    기존에는 패키지 요금제의 총액을 위치 수로 균등 분배했는데,
--    홈 상단과 사이드의 값어치가 같을 리 없으므로 실제 계약과 어긋난다.
-- 2) 말머리에 운영 메모를 붙인다(스폰서 계약 조건·담당자 등).
-- ============================================================

-- ------------------------------------------------------------
-- 1. 요금제 위치별 단가
--    형태: {"home_top": 400000, "post_detail": 200000}
--    NULL 이면 기존 동작(price_krw 를 위치 수로 균등 분배)을 그대로 유지한다.
--    price_krw 는 계속 "총액"으로 남는다 — 목록·가이드·매출 집계가 이 값을 쓴다.
-- ------------------------------------------------------------
ALTER TABLE public.bw_banner_plans
  ADD COLUMN IF NOT EXISTS placement_prices JSONB;

COMMENT ON COLUMN public.bw_banner_plans.placement_prices IS
  '위치별 단가 맵. NULL 이면 price_krw 를 위치 수로 균등 분배. 합계는 price_krw 와 일치해야 한다.';

-- 기존 요금제 5건을 위치별 단가로 채워 넣는다.
-- 단일 위치 요금제는 총액이 곧 그 위치의 단가라 손실 없이 변환된다.
UPDATE public.bw_banner_plans
SET placement_prices = jsonb_build_object(placements[1], price_krw)
WHERE placement_prices IS NULL
  AND array_length(placements, 1) = 1;

-- 복수 위치 요금제는 사람이 값을 정해야 하므로 자동 변환하지 않는다.
-- (NULL 로 두면 종전과 똑같이 균등 분배되므로 동작 변화 없음)

-- ------------------------------------------------------------
-- 2. 말머리 운영 메모
--    "왜 이 말머리가 있는지 / 언제까지인지" 를 말머리 옆에 붙여둔다.
--    광고 계약 자체의 메모(bw_banners.memo)와는 층이 다르다 —
--    배너 메모는 "이번 건", 말머리 메모는 "이 제휴 관계".
-- ------------------------------------------------------------
ALTER TABLE public.bw_post_categories
  ADD COLUMN IF NOT EXISTS memo TEXT;

COMMENT ON COLUMN public.bw_post_categories.memo IS
  '운영자 전용 메모. 공개 사이트에는 노출되지 않는다(get_visible_post_categories 가 반환하지 않음).';
