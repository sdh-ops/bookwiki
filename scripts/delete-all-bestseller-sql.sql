-- Supabase SQL Editor에서 실행
-- 모든 베스트셀러 데이터 삭제

DELETE FROM bw_bestseller_snapshots;
DELETE FROM bw_books;

-- 확인
SELECT COUNT(*) as snapshot_count FROM bw_bestseller_snapshots;
SELECT COUNT(*) as book_count FROM bw_books;
