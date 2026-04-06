-- ============================================================
-- Disk IO 최적화 마이그레이션
-- ============================================================

-- 1. bw_books (title, author) 복합 인덱스
--    베스트셀러 스크래퍼에서 책 1권당 1번 full scan하던 문제 해결
CREATE INDEX IF NOT EXISTS idx_books_title_author
  ON bw_books(title, author);

-- 2. bw_page_views 복합 인덱스 (어드민 날짜 범위 쿼리 최적화)
CREATE INDEX IF NOT EXISTS idx_page_views_visited_path
  ON bw_page_views(visited_at DESC, path);

-- 3. view_count atomic increment 함수
--    클라이언트에서 read → +1 → write 패턴 대신 DB 내부에서 원자적으로 처리
--    race condition 제거 + 불필요한 SELECT 쿼리 1회 제거
CREATE OR REPLACE FUNCTION increment_view_count(post_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE bw_posts
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = post_id;
$$;

-- 익명 사용자도 RPC 호출 가능하도록 권한 부여
GRANT EXECUTE ON FUNCTION increment_view_count(uuid) TO anon, authenticated;

-- 4. pg_cron: page_views 30일 이상 데이터 자동 삭제
--    아래 순서로 실행:
--    1) Supabase 대시보드 → Database → Extensions → pg_cron → Enable
--    2) 아래 SQL만 별도로 실행
--
-- SELECT cron.schedule(
--   'cleanup-page-views-30d',
--   '0 3 * * *',
--   $$DELETE FROM bw_page_views WHERE visited_at < NOW() - INTERVAL '30 days';$$
-- );
