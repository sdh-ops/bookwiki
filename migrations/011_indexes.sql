-- 게시글 목록 조회 (board_type별 최신순) - 메인 페이지 핵심 쿼리
CREATE INDEX IF NOT EXISTS idx_posts_board_created
  ON bw_posts(board_type, created_at DESC);

-- 게시글 단건 조회 + view_count 업데이트
CREATE INDEX IF NOT EXISTS idx_posts_id_created
  ON bw_posts(id, created_at DESC);

-- 베스트셀러 핵심 쿼리 (날짜 + 카테고리 + 기간타입 + 순위)
CREATE INDEX IF NOT EXISTS idx_snapshots_lookup
  ON bw_bestseller_snapshots(snapshot_date, common_category, period_type, rank);

-- 베스트셀러 트렌드 분석 (책별 날짜 추이)
CREATE INDEX IF NOT EXISTS idx_snapshots_book_date
  ON bw_bestseller_snapshots(book_id, snapshot_date, platform);

-- 댓글 조회 (post_id별)
CREATE INDEX IF NOT EXISTS idx_comments_post
  ON bw_comments(post_id, created_at);

-- 방문자 통계 (날짜별)
CREATE INDEX IF NOT EXISTS idx_page_views_visited
  ON bw_page_views(visited_at DESC);

-- 회원 게시글/댓글 활성 사용자 집계
CREATE INDEX IF NOT EXISTS idx_posts_user_created
  ON bw_posts(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comments_user_created
  ON bw_comments(user_id, created_at DESC);
