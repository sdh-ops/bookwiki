-- 베스트셀러 데이터 완전 삭제
-- Supabase 대시보드의 SQL Editor에서 실행하세요

-- 1. 스냅샷 데이터 모두 삭제
DELETE FROM bw_bestseller_snapshots;

-- 2. 책 데이터 모두 삭제
DELETE FROM bw_books;

-- 확인
SELECT
  (SELECT COUNT(*) FROM bw_bestseller_snapshots) as snapshot_count,
  (SELECT COUNT(*) FROM bw_books) as book_count;
