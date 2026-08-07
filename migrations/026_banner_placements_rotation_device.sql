-- ============================================================
-- 026_banner_placements_rotation_device.sql
-- ============================================================
-- 1) 게재 위치 확장(게시글 하단 / PC 사이드) 지원용 위치별 설정 테이블
-- 2) 동기간 복수 배너 로테이션 방식(랜덤/가중치/고정) 설정
-- 3) 노출·클릭·방문 로그에 기기 구분(device_type) 추가 → PC/모바일 분리 리포트
-- 4) 게재 기간 판정을 KST 기준으로 교정 (UTC CURRENT_DATE 사용 시 00~09시에 하루 밀림)
-- 5) 트래픽 집계 RPC 를 비로그인(anon) 이 호출하지 못하게 차단
--
-- placement 는 자유 TEXT 컬럼이라 위치 추가 자체에는 스키마 변경이 필요 없다.
-- 애플리케이션이 'post_bottom' / 'sidebar' 값을 새로 사용하기만 하면 된다.
-- ============================================================

-- ------------------------------------------------------------
-- 1. 배너 가중치 (weighted 로테이션에서 노출 비중)
-- ------------------------------------------------------------
ALTER TABLE public.bw_banners
  ADD COLUMN IF NOT EXISTS weight INT NOT NULL DEFAULT 1;

-- 0 이하 가중치는 확률 계산에서 의미가 없으므로 최소 1 로 강제
ALTER TABLE public.bw_banners DROP CONSTRAINT IF EXISTS bw_banners_weight_positive;
ALTER TABLE public.bw_banners
  ADD CONSTRAINT bw_banners_weight_positive CHECK (weight >= 1);

-- ------------------------------------------------------------
-- 2. 위치별 노출 설정
--    rotation_mode
--      random   : 게재중 배너 중 균등 랜덤 (기본)
--      weighted : weight 비중에 따른 가중 랜덤
--      fixed    : sort_order 가 가장 앞선 1개만 고정 노출
--    show_placeholder : 게재중 배너가 없을 때 "광고 배너 영역" 자리를 보여줄지
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bw_placement_settings (
  placement        TEXT PRIMARY KEY,
  rotation_mode    TEXT    NOT NULL DEFAULT 'random'
                   CHECK (rotation_mode IN ('random', 'weighted', 'fixed')),
  show_placeholder BOOLEAN NOT NULL DEFAULT false,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.bw_placement_settings ENABLE ROW LEVEL SECURITY;

-- 공개: 배너 슬롯이 렌더링 시 노출 방식을 읽어야 하므로 SELECT 허용
--       (설정값 자체는 민감정보가 아니다)
DROP POLICY IF EXISTS "public_select_placement_settings" ON public.bw_placement_settings;
CREATE POLICY "public_select_placement_settings" ON public.bw_placement_settings
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "admin_manage_placement_settings" ON public.bw_placement_settings;
CREATE POLICY "admin_manage_placement_settings" ON public.bw_placement_settings
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.bw_admins WHERE email = (SELECT auth.jwt() ->> 'email'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.bw_admins WHERE email = (SELECT auth.jwt() ->> 'email'))
  );

-- 위치 4종 시드. 이미 있는 행은 건드리지 않는다(운영 중 설정 보존).
-- 홈 상단만 기본으로 플레이스홀더를 노출한다 — 나머지 위치까지 검은 박스가 뜨면
-- 빈 광고칸이 사이트 전체에 깔려 보이기 때문.
INSERT INTO public.bw_placement_settings (placement, rotation_mode, show_placeholder)
VALUES
  ('home_top',    'random', true),
  ('post_detail', 'random', false),
  ('post_bottom', 'random', false),
  ('sidebar',     'random', false)
ON CONFLICT (placement) DO NOTHING;

-- ------------------------------------------------------------
-- 3. 기기 구분 (pc / mobile / tablet)
-- ------------------------------------------------------------
ALTER TABLE public.bw_banner_events ADD COLUMN IF NOT EXISTS device_type TEXT;
ALTER TABLE public.bw_page_views    ADD COLUMN IF NOT EXISTS device_type TEXT;

CREATE INDEX IF NOT EXISTS idx_bw_banner_events_device
  ON public.bw_banner_events(device_type, created_at);
CREATE INDEX IF NOT EXISTS idx_bw_page_views_device
  ON public.bw_page_views(device_type, visited_at);

-- 이벤트 INSERT 정책: 값 검증에 device_type 허용값을 추가.
-- (레거시 로그 호환을 위해 NULL 은 계속 허용)
DROP POLICY IF EXISTS "public_insert_banner_events" ON public.bw_banner_events;
CREATE POLICY "public_insert_banner_events" ON public.bw_banner_events
  FOR INSERT TO public
  WITH CHECK (
    event_type IN ('impression', 'click')
    AND (device_type IS NULL OR device_type IN ('pc', 'mobile', 'tablet', 'unknown'))
  );

-- ------------------------------------------------------------
-- 4. 게재 기간 판정을 KST 로 교정
--    Supabase 인스턴스 타임존이 UTC 라 CURRENT_DATE 는 UTC 날짜다.
--    KST 00:00~09:00 사이에는 하루 전 날짜로 판정돼 "오늘 시작" 배너가 안 뜬다.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "public_select_active_banners" ON public.bw_banners;
CREATE POLICY "public_select_active_banners" ON public.bw_banners
  FOR SELECT TO public
  USING (
    is_active = true
    AND is_deleted = false
    AND (start_date IS NULL OR start_date <= (NOW() AT TIME ZONE 'Asia/Seoul')::date)
    AND (end_date   IS NULL OR end_date   >= (NOW() AT TIME ZONE 'Asia/Seoul')::date)
  );

-- ------------------------------------------------------------
-- 5. 광고주 리포트 RPC v2 — 기기별(PC/모바일) 분리 + 위치 포함
--    반환 타입이 바뀌므로 CREATE OR REPLACE 가 아니라 DROP 후 재생성해야 한다.
--    태블릿은 광고주 리포트 관례상 '모바일'로 합산한다(원본 로그는 3종 그대로 보존).
--    device_type 이 NULL 인 레거시 로그는 pc/mobile 어느 쪽에도 넣지 않는다
--    → pc + mobile <= 전체 노출수 가 될 수 있으며, 이는 의도된 동작이다.
-- ------------------------------------------------------------
-- 라이브 시그니처가 마이그레이션 파일과 다를 수 있으므로 이름 기준으로 전부 정리한다
-- (시그니처를 찍어서 DROP 하면 안 맞을 때 조용히 통과하고, 이어지는 CREATE 가
--  "cannot change return type of existing function" 으로 실패한다)
DO $$
DECLARE fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_banner_stats'
  LOOP
    EXECUTE format('DROP FUNCTION %s', fn.sig);
  END LOOP;
END $$;

CREATE FUNCTION public.get_banner_stats(days_back INT DEFAULT 30)
RETURNS TABLE (
  banner_id             UUID,
  banner_name           TEXT,
  advertiser            TEXT,
  placement             TEXT,
  is_active             BOOLEAN,
  impressions           BIGINT,
  impressions_pc        BIGINT,
  impressions_mobile    BIGINT,
  clicks                BIGINT,
  clicks_pc             BIGINT,
  clicks_mobile         BIGINT,
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
    COUNT(*) FILTER (WHERE e.event_type = 'impression')                        AS impressions,
    COUNT(*) FILTER (WHERE e.event_type = 'impression'
                       AND e.device_type = 'pc')                               AS impressions_pc,
    COUNT(*) FILTER (WHERE e.event_type = 'impression'
                       AND e.device_type IN ('mobile', 'tablet'))              AS impressions_mobile,
    COUNT(*) FILTER (WHERE e.event_type = 'click')                             AS clicks,
    COUNT(*) FILTER (WHERE e.event_type = 'click'
                       AND e.device_type = 'pc')                               AS clicks_pc,
    COUNT(*) FILTER (WHERE e.event_type = 'click'
                       AND e.device_type IN ('mobile', 'tablet'))              AS clicks_mobile,
    COUNT(DISTINCT e.session_id) FILTER (WHERE e.event_type = 'click')         AS unique_click_sessions,
    ROUND(
      COALESCE(
        COUNT(*) FILTER (WHERE e.event_type = 'click')::numeric
        / NULLIF(COUNT(*) FILTER (WHERE e.event_type = 'impression'), 0) * 100,
        0
      ), 2
    )                                                                          AS ctr
  FROM public.bw_banners b
  LEFT JOIN public.bw_banner_events e
    ON e.banner_id = b.id
   AND e.created_at >= NOW() - (days_back || ' days')::interval
  WHERE b.is_deleted = false OR EXISTS (SELECT 1 FROM public.bw_banner_events x WHERE x.banner_id = b.id)
  GROUP BY b.id, b.name, b.advertiser, b.placement, b.is_active
  ORDER BY impressions DESC;
$$;

-- SECURITY INVOKER(기본) 이라 이벤트 SELECT RLS(관리자 전용)를 그대로 따른다.
-- 비관리자가 호출하면 이벤트가 필터되어 0 으로만 보인다. 그래도 관리 화면 전용이므로
-- 비로그인(anon) 호출 경로는 닫는다.
REVOKE ALL ON FUNCTION public.get_banner_stats(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_banner_stats(INT) TO authenticated;

-- ------------------------------------------------------------
-- 6. 사이트 전체 PC/모바일 유입 집계 (신규)
--    기존 get_page_view_stats 는 손대지 않고 별도 함수로 추가한다
--    (대시보드 기존 탭이 깨지지 않도록).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_page_view_device_stats(days_back INT DEFAULT 30)
RETURNS TABLE (
  kst_date        TEXT,
  pc_pageviews    BIGINT,
  mobile_pageviews BIGINT,
  unknown_pageviews BIGINT,
  pc_sessions     BIGINT,
  mobile_sessions BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    to_char((v.visited_at AT TIME ZONE 'Asia/Seoul')::date, 'YYYY-MM-DD')          AS kst_date,
    COUNT(*) FILTER (WHERE v.device_type = 'pc')                                   AS pc_pageviews,
    COUNT(*) FILTER (WHERE v.device_type IN ('mobile', 'tablet'))                  AS mobile_pageviews,
    COUNT(*) FILTER (WHERE v.device_type IS NULL OR v.device_type = 'unknown')     AS unknown_pageviews,
    COUNT(DISTINCT v.session_id) FILTER (WHERE v.device_type = 'pc')               AS pc_sessions,
    COUNT(DISTINCT v.session_id) FILTER (WHERE v.device_type IN ('mobile','tablet')) AS mobile_sessions
  FROM public.bw_page_views v
  WHERE v.visited_at >= NOW() - (days_back || ' days')::interval
  GROUP BY 1
  ORDER BY 1 DESC;
$$;

REVOKE ALL ON FUNCTION public.get_page_view_device_stats(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_page_view_device_stats(INT) TO authenticated;

-- ------------------------------------------------------------
-- 7. 기존 집계 RPC 를 비로그인 호출에서 차단
--    get_page_view_stats 는 SECURITY DEFINER 라 공개 anon 키만 있으면
--    누구나 북위키 일별 PV·세션을 그대로 읽을 수 있었다.
--    함수 정의는 건드리지 않고 실행 권한만 조인다.
--    라이브 시그니처를 모른 채 하드코딩하면 조용히 빗나가므로 이름으로 훑는다.
-- ------------------------------------------------------------
DO $$
DECLARE fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('get_page_view_stats', 'get_banner_daily_stats')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn.sig);
    RAISE NOTICE '권한 조정: %', fn.sig;
  END LOOP;
END $$;
