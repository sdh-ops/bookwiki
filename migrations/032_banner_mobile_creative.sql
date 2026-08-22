-- ============================================================
-- 032_banner_mobile_creative.sql
-- ============================================================
-- 배너 소재를 PC · 모바일 두 장으로 나눠 올릴 수 있게 한다.
--
--   image_url        : PC 소재 (지금까지 쓰던 칸 · 그대로 필수)
--   image_url_mobile : 모바일 전용 소재 (NULL 허용)
--
-- NULL 이면 지금과 완전히 동일하게 동작한다 — PC 소재 한 장을 모바일에서
-- 가운데만 남기고 잘라 쓰는 "안전영역" 방식. 따라서 기존 배너는 손댈 것이 없다.
--
-- ⚠️ 적용 순서: 이 마이그레이션을 Supabase SQL Editor 에서 먼저 실행한 뒤에
--    코드를 배포해야 한다. 반대로 하면 Banner/ManageTab 이 없는 컬럼을 조회·저장해
--    공개 배너가 안 뜨고 배너 등록이 실패한다.
--
-- RLS 변경 없음 — bw_banners 의 정책은 행 단위(게재중 여부)라 컬럼이 늘어도
-- 그대로 적용된다. 값 자체가 공개 이미지 URL 이므로 노출에 문제 없다.
-- ============================================================

ALTER TABLE public.bw_banners
  ADD COLUMN IF NOT EXISTS image_url_mobile TEXT;

COMMENT ON COLUMN public.bw_banners.image_url_mobile IS
  '모바일 전용 배너 소재 URL. NULL 이면 image_url(PC 소재)을 가운데 크롭해 사용한다.';
