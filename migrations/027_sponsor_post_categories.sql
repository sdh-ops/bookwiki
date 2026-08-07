-- ============================================================
-- 027_sponsor_post_categories.sql
-- ============================================================
-- 게시판 말머리(카테고리)를 DB 로 옮기고, "스폰서 말머리" 개념을 추가한다.
--
-- 기존: 말머리가 src/app/page.js 와 src/app/write/page.js 에 각각 하드코딩되어
--       있었고, 선택한 말머리는 제목 앞에 '[잡담] ' 형태로 저장된다(이 저장 방식은 유지).
--
-- 추가: sponsor_advertiser 가 채워진 말머리는 "그 광고주의 배너가 게재중일 때만"
--       글쓰기 화면과 목록 필터에 나타난다. 광고가 끝나면 말머리 선택지는 자동으로
--       사라지고, 이미 그 말머리로 작성된 과거 글의 제목은 그대로 남는다(정상).
-- ============================================================

-- ------------------------------------------------------------
-- 1. 말머리 테이블
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bw_post_categories (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  board_type         TEXT NOT NULL DEFAULT 'free',   -- free / job / support
  label              TEXT NOT NULL,                  -- 제목 앞에 '[label] ' 로 붙는 문자열
  sort_order         INT  NOT NULL DEFAULT 0,
  is_active          BOOLEAN NOT NULL DEFAULT true,
  sponsor_advertiser TEXT,                           -- NULL=상시 노출 / 값=해당 광고주 게재중일 때만
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bw_post_categories_board_label
  ON public.bw_post_categories(board_type, label);

ALTER TABLE public.bw_post_categories ENABLE ROW LEVEL SECURITY;

-- 공개: 활성 말머리 SELECT 허용.
--   ※ 스폰서 게이트(광고 게재중인지)는 이 정책이 아니라 아래 RPC 가 판정한다.
--      공개 사이트는 반드시 RPC 를 쓰고, 이 정책은 관리 화면 폴백용이다.
DROP POLICY IF EXISTS "public_select_post_categories" ON public.bw_post_categories;
CREATE POLICY "public_select_post_categories" ON public.bw_post_categories
  FOR SELECT TO public USING (is_active = true);

DROP POLICY IF EXISTS "admin_manage_post_categories" ON public.bw_post_categories;
CREATE POLICY "admin_manage_post_categories" ON public.bw_post_categories
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.bw_admins WHERE email = (SELECT auth.jwt() ->> 'email'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.bw_admins WHERE email = (SELECT auth.jwt() ->> 'email'))
  );

-- ------------------------------------------------------------
-- 2. 시드 — 톡톡 기존 말머리 3종 + 한겨레교육 스폰서 말머리
--    (기존 하드코딩 값과 정확히 동일해야 과거 글 필터가 계속 맞는다)
-- ------------------------------------------------------------
INSERT INTO public.bw_post_categories (board_type, label, sort_order, sponsor_advertiser)
VALUES
  ('free', '잡담',      1, NULL),
  ('free', '후기',      2, NULL),
  ('free', '모집',      3, NULL),
  ('free', '한겨레교육', 4, '한겨레교육')
ON CONFLICT (board_type, label) DO NOTHING;

-- ------------------------------------------------------------
-- 3. 노출 판정 RPC
--    스폰서 말머리는 해당 광고주의 배너가 "지금 게재중"일 때만 반환한다.
--    게재중 판정 기준은 공개 배너 RLS 와 동일(활성 + 미삭제 + KST 날짜창).
--
--    SECURITY DEFINER 인 이유: 비로그인 방문자는 bw_banners 를 직접 못 읽는 조건이
--    있을 수 있고, 여기서는 "광고가 있냐 없냐" 라는 불리언만 소비하기 때문.
--    광고 정보 자체는 한 건도 반환하지 않는다.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_visible_post_categories(p_board_type TEXT DEFAULT 'free')
RETURNS TABLE (
  label              TEXT,
  sort_order         INT,
  sponsor_advertiser TEXT,
  is_sponsored       BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    c.label,
    c.sort_order,
    c.sponsor_advertiser,
    (c.sponsor_advertiser IS NOT NULL) AS is_sponsored
  FROM public.bw_post_categories c
  WHERE c.is_active = true
    AND c.board_type = p_board_type
    AND (
      c.sponsor_advertiser IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.bw_banners b
        WHERE b.advertiser = c.sponsor_advertiser
          AND b.is_active  = true
          AND b.is_deleted = false
          AND (b.start_date IS NULL OR b.start_date <= (NOW() AT TIME ZONE 'Asia/Seoul')::date)
          AND (b.end_date   IS NULL OR b.end_date   >= (NOW() AT TIME ZONE 'Asia/Seoul')::date)
      )
    )
  ORDER BY c.sort_order, c.label;
$$;

-- 공개 사이트(비로그인 포함)가 호출해야 하므로 anon 에도 실행 권한을 준다.
REVOKE ALL ON FUNCTION public.get_visible_post_categories(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_visible_post_categories(TEXT) TO anon, authenticated;
