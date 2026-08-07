-- ============================================================
-- 029_retire_post_detail_placement.sql
-- ============================================================
-- '게시글 상단'(post_detail) 게재 위치를 운영에서 내린다.
-- 게시글 본문 위·아래 두 자리를 함께 팔면 글 읽는 흐름이 광고에 두 번 끊겨
-- 커뮤니티 체감이 나빠진다. 체류가 긴 '댓글 위'(post_bottom) 한 자리만 남긴다.
--
-- 데이터는 지우지 않는다 — 과거 계약·성과 기록이 매출 관리에 남아야 하므로
-- 화면 라벨만 '게시글 상단(운영 종료)'로 유지하고(프론트), 신규 등록 경로만 닫는다.
-- ============================================================

-- ------------------------------------------------------------
-- 1. 위치별 노출 설정에서 제거
--    (배너가 한 건도 없던 자리라 남겨두면 설정 화면에만 유령 행이 남는다)
-- ------------------------------------------------------------
DELETE FROM public.bw_placement_settings WHERE placement = 'post_detail';

-- ------------------------------------------------------------
-- 2. 기존 요금제를 남은 게시글 자리로 옮긴다
--    '게시글배너 1개월/1주일' 과 패키지 요금제가 post_detail 을 가리키고 있어
--    그대로 두면 그 요금제로 등록한 배너가 아무 데도 노출되지 않는다.
--    가격은 그대로 두고 가리키는 위치만 post_bottom 으로 바꾼다.
-- ------------------------------------------------------------
UPDATE public.bw_banner_plans
SET placements = array_replace(placements, 'post_detail', 'post_bottom'),
    updated_at = NOW()
WHERE 'post_detail' = ANY(placements);

-- 위치별 단가 맵의 키도 함께 옮긴다 (값은 보존)
UPDATE public.bw_banner_plans
SET placement_prices =
      (placement_prices - 'post_detail')
      || jsonb_build_object('post_bottom', placement_prices -> 'post_detail'),
    updated_at = NOW()
WHERE placement_prices ? 'post_detail';

-- ------------------------------------------------------------
-- 3. 혹시 남아 있을 post_detail 배너는 게재만 중지한다
--    (기록은 매출 관리에 남겨야 하므로 삭제하지 않는다)
-- ------------------------------------------------------------
UPDATE public.bw_banners
SET is_active = false, updated_at = NOW()
WHERE placement = 'post_detail' AND is_active = true;
