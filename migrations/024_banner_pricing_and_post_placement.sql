-- ============================================================
-- 024_banner_pricing_and_post_placement.sql
-- ============================================================
-- '게시글 배너' 신설: placement 는 자유 TEXT 컬럼이라 스키마 변경 없이
--   애플리케이션에서 'post_detail' 값을 새로 사용하기만 하면 된다.
--
-- 요금제(bw_banner_plans)를 관리자 화면에서 직접 CRUD 할 수 있게 테이블로
-- 분리하고, bw_banners 에 계약 금액/요금제 참조/입금 상태/메모를 추가한다.
-- ============================================================

-- ------------------------------------------------------------
-- 1. 요금제 테이블
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bw_banner_plans (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,          -- 예: "상단배너 1개월"
  placements    TEXT[] NOT NULL,               -- 예: {home_top} 또는 {home_top,post_detail}
  duration_days INT NOT NULL,
  price_krw     INT NOT NULL,                  -- 전체 계약 금액(VAT 별도). 위치가 2개면 등록 시 균등 분배
  is_active     BOOLEAN NOT NULL DEFAULT true, -- 비활성화하면 신규 등록 드롭다운에서만 숨김
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.bw_banner_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_manage_banner_plans" ON public.bw_banner_plans;
CREATE POLICY "admin_manage_banner_plans" ON public.bw_banner_plans
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.bw_admins WHERE email = (SELECT auth.jwt() ->> 'email'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.bw_admins WHERE email = (SELECT auth.jwt() ->> 'email'))
  );

-- 초기 요금제 시드 (2026년 7월 기준, VAT 별도). 테이블이 비어있을 때만 채워 넣는다.
INSERT INTO public.bw_banner_plans (name, placements, duration_days, price_krw, sort_order)
SELECT * FROM (VALUES
  ('상단배너 1개월',           ARRAY['home_top'],               30, 400000, 1),
  ('상단배너 1주일',           ARRAY['home_top'],               7,  150000, 2),
  ('게시글배너 1개월',         ARRAY['post_detail'],            30, 300000, 3),
  ('게시글배너 1주일',         ARRAY['post_detail'],            7,  100000, 4),
  ('상단+게시글 패키지 1개월', ARRAY['home_top', 'post_detail'], 30, 600000, 5)
) AS seed(name, placements, duration_days, price_krw, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.bw_banner_plans);

-- ------------------------------------------------------------
-- 2. bw_banners: 계약 금액 / 요금제 참조 / 입금 상태 / 메모
-- ------------------------------------------------------------
ALTER TABLE public.bw_banners
  ADD COLUMN IF NOT EXISTS price_krw INT,
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.bw_banner_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT '미입금'
    CHECK (payment_status IN ('미입금', '입금완료', '취소')),
  ADD COLUMN IF NOT EXISTS memo TEXT;

CREATE INDEX IF NOT EXISTS idx_bw_banners_payment_status ON public.bw_banners(payment_status);
