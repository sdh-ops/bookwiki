-- ============================================================
-- 023_banner_ads.sql
-- ============================================================
-- 배너 광고 시스템 + 노출/클릭 추적
--   * bw_banners        : 광고 소재(캠페인) 정의
--   * bw_banner_events  : 노출(impression) / 클릭(click) 원천 로그
--   * get_banner_stats  : 광고주 리포트용 집계 RPC (노출·클릭·CTR)
-- 추적 패턴은 기존 bw_page_views(009) 를 그대로 따른다.
-- ============================================================

-- ------------------------------------------------------------
-- 1. 배너 소재 테이블
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bw_banners (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,                         -- 캠페인 이름 (관리용)
  advertiser  TEXT,                                  -- 광고주명 (리포트 그룹핑)
  image_url   TEXT NOT NULL,                         -- 배너 이미지 URL
  link_url    TEXT NOT NULL,                         -- 클릭 시 이동 URL
  placement   TEXT NOT NULL DEFAULT 'home_top',      -- 노출 위치 (home_top 등)
  is_active   BOOLEAN NOT NULL DEFAULT true,         -- 게재 on/off
  start_date  DATE,                                  -- 게재 시작 (NULL=제한없음)
  end_date    DATE,                                  -- 게재 종료 (NULL=제한없음)
  sort_order  INT NOT NULL DEFAULT 0,                -- 동일 위치 내 정렬
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bw_banners_placement_active
  ON public.bw_banners(placement, is_active);

-- ------------------------------------------------------------
-- 2. 노출/클릭 이벤트 로그
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bw_banner_events (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  banner_id   UUID NOT NULL REFERENCES public.bw_banners(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL CHECK (event_type IN ('impression', 'click')),
  session_id  TEXT,                                  -- 방문 세션 (중복/순사용자 집계)
  path        TEXT,                                  -- 발생 경로
  user_id     UUID,                                  -- 로그인 사용자 (비회원 NULL)
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bw_banner_events_banner_time
  ON public.bw_banner_events(banner_id, created_at);
CREATE INDEX IF NOT EXISTS idx_bw_banner_events_type_time
  ON public.bw_banner_events(event_type, created_at);

-- ------------------------------------------------------------
-- 3. RLS
-- ------------------------------------------------------------
ALTER TABLE public.bw_banners       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bw_banner_events ENABLE ROW LEVEL SECURITY;

-- 3-1. bw_banners
--   공개: 현재 게재중인(활성 + 날짜창 내) 배너만 조회 가능
DROP POLICY IF EXISTS "public_select_active_banners" ON public.bw_banners;
CREATE POLICY "public_select_active_banners" ON public.bw_banners
  FOR SELECT TO public
  USING (
    is_active = true
    AND (start_date IS NULL OR start_date <= CURRENT_DATE)
    AND (end_date   IS NULL OR end_date   >= CURRENT_DATE)
  );

--   관리자: 전체 CRUD
DROP POLICY IF EXISTS "admin_manage_banners" ON public.bw_banners;
CREATE POLICY "admin_manage_banners" ON public.bw_banners
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.bw_admins WHERE email = (SELECT auth.jwt() ->> 'email'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.bw_admins WHERE email = (SELECT auth.jwt() ->> 'email'))
  );

-- 3-2. bw_banner_events
--   공개: 노출/클릭 기록 INSERT (비로그인 방문자 포함)
DROP POLICY IF EXISTS "public_insert_banner_events" ON public.bw_banner_events;
CREATE POLICY "public_insert_banner_events" ON public.bw_banner_events
  FOR INSERT TO public
  WITH CHECK (event_type IN ('impression', 'click'));

--   관리자만 SELECT (리포트 조회)
DROP POLICY IF EXISTS "admin_select_banner_events" ON public.bw_banner_events;
CREATE POLICY "admin_select_banner_events" ON public.bw_banner_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.bw_admins WHERE email = (SELECT auth.jwt() ->> 'email'))
  );

-- ------------------------------------------------------------
-- 4. 집계 RPC (광고주 리포트)
--   SECURITY INVOKER(기본) → 이벤트 SELECT RLS(관리자 전용)를 그대로 준수.
--   비관리자가 호출하면 이벤트 row가 필터되어 0으로만 반환된다.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_banner_stats(days_back INT DEFAULT 30)
RETURNS TABLE (
  banner_id             UUID,
  banner_name           TEXT,
  advertiser            TEXT,
  placement             TEXT,
  is_active             BOOLEAN,
  impressions           BIGINT,
  clicks                BIGINT,
  unique_click_sessions BIGINT,
  ctr                   NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    b.id,
    b.name,
    b.advertiser,
    b.placement,
    b.is_active,
    COUNT(*) FILTER (WHERE e.event_type = 'impression')                      AS impressions,
    COUNT(*) FILTER (WHERE e.event_type = 'click')                           AS clicks,
    COUNT(DISTINCT e.session_id) FILTER (WHERE e.event_type = 'click')       AS unique_click_sessions,
    ROUND(
      COALESCE(
        COUNT(*) FILTER (WHERE e.event_type = 'click')::numeric
        / NULLIF(COUNT(*) FILTER (WHERE e.event_type = 'impression'), 0) * 100,
        0
      ), 2
    )                                                                        AS ctr
  FROM public.bw_banners b
  LEFT JOIN public.bw_banner_events e
    ON e.banner_id = b.id
   AND e.created_at >= NOW() - (days_back || ' days')::interval
  GROUP BY b.id, b.name, b.advertiser, b.placement, b.is_active
  ORDER BY impressions DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_banner_stats(INT) TO anon, authenticated;

-- ------------------------------------------------------------
-- 5. 일별 시계열 RPC (기간 추이 차트용)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_banner_daily_stats(
  p_banner_id UUID DEFAULT NULL,
  days_back   INT  DEFAULT 30
)
RETURNS TABLE (
  kst_date    TEXT,
  impressions BIGINT,
  clicks      BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    to_char((e.created_at AT TIME ZONE 'Asia/Seoul')::date, 'YYYY-MM-DD') AS kst_date,
    COUNT(*) FILTER (WHERE e.event_type = 'impression') AS impressions,
    COUNT(*) FILTER (WHERE e.event_type = 'click')      AS clicks
  FROM public.bw_banner_events e
  WHERE e.created_at >= NOW() - (days_back || ' days')::interval
    AND (p_banner_id IS NULL OR e.banner_id = p_banner_id)
  GROUP BY 1
  ORDER BY 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_banner_daily_stats(UUID, INT) TO anon, authenticated;

-- ------------------------------------------------------------
-- 6. 데이터 보존 정책 (원천 이벤트 6개월 유지)
--    bw_page_views(3개월)보다 길게 — 광고 정산 기간 고려
-- ------------------------------------------------------------
DELETE FROM public.bw_banner_events WHERE created_at < NOW() - INTERVAL '6 months';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'bw-banner-events-retention',
      '0 1 * * *',
      $cron$DELETE FROM public.bw_banner_events WHERE created_at < NOW() - INTERVAL '6 months'$cron$
    );
  END IF;
END $$;
