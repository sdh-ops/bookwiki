-- ============================================================
-- 025_banner_soft_delete.sql
-- ============================================================
-- bw_posts/bw_comments 와 동일한 소프트 삭제 컨벤션을 bw_banners 에도 적용.
-- 배너를 "삭제"해도 매출/성과 기록(bw_banner_events, price_krw, payment_status 등)이
-- 영구히 사라지지 않도록 하드 DELETE 대신 숨김 처리한다.
-- ============================================================

ALTER TABLE public.bw_banners
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_bw_banners_is_deleted ON public.bw_banners(is_deleted);

-- 공개 SELECT 정책에 is_deleted 조건 추가 (is_active=false 와 별개로 이중 방어)
DROP POLICY IF EXISTS "public_select_active_banners" ON public.bw_banners;
CREATE POLICY "public_select_active_banners" ON public.bw_banners
  FOR SELECT TO public
  USING (
    is_active = true
    AND is_deleted = false
    AND (start_date IS NULL OR start_date <= CURRENT_DATE)
    AND (end_date   IS NULL OR end_date   >= CURRENT_DATE)
  );

-- admin_manage_banners(FOR ALL) 정책은 그대로 유지 — 관리자는 삭제된 배너도 조회/복원 가능
