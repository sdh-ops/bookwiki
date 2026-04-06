-- 방문자 추적 테이블
CREATE TABLE IF NOT EXISTS bw_page_views (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  visited_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  path TEXT NOT NULL,
  session_id TEXT NOT NULL
);

ALTER TABLE bw_page_views ENABLE ROW LEVEL SECURITY;

-- 누구나 INSERT 가능 (비로그인 방문자 포함)
CREATE POLICY "public_insert_page_views" ON bw_page_views
  FOR INSERT TO public WITH CHECK (true);

-- 로그인 사용자(관리자)만 SELECT 가능
CREATE POLICY "auth_select_page_views" ON bw_page_views
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_bw_page_views_visited_at ON bw_page_views(visited_at);
CREATE INDEX IF NOT EXISTS idx_bw_page_views_session ON bw_page_views(session_id, visited_at);
