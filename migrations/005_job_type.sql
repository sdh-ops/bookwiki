-- 구인구직 게시판 구인/구직 타입 추가
-- 실행 날짜: 2026-03-19
-- 설명: 구인구직 게시판에 구인/구직 명시적 분류 기능 추가

-- ============================================================
-- 1. job_type 컬럼 추가
-- ============================================================
ALTER TABLE bw_posts
ADD COLUMN IF NOT EXISTS job_type VARCHAR(20) CHECK (job_type IN ('hiring', 'seeking'));

COMMENT ON COLUMN bw_posts.job_type IS '구인구직 타입: hiring(구인), seeking(구직)';

-- ============================================================
-- 2. 기존 데이터 마이그레이션 (제목 키워드 기반 자동 분류)
-- ============================================================
UPDATE bw_posts
SET job_type = CASE
  WHEN title ILIKE '%모십니다%'
    OR title ILIKE '%채용%'
    OR title ILIKE '%모집%'
    OR title ILIKE '%구합니다%'
    OR title ILIKE '%채용합니다%'
    OR title ILIKE '%찾습니다%'
    THEN 'hiring'
  WHEN title ILIKE '%구직%'
    OR title ILIKE '%지원%'
    OR title ILIKE '%희망%'
    OR title ILIKE '%원합니다%'
    THEN 'seeking'
  ELSE 'hiring' -- 기본값: 구인으로 설정
END
WHERE board_type = 'job' AND job_type IS NULL;

-- ============================================================
-- 3. 인덱스 추가 (필터링 성능 향상)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_bw_posts_job_type
  ON bw_posts(job_type)
  WHERE board_type = 'job';

-- 복합 인덱스: 구인구직 게시판 + job_type + 생성일
CREATE INDEX IF NOT EXISTS idx_bw_posts_job_board_type_created
  ON bw_posts(board_type, job_type, created_at DESC)
  WHERE board_type = 'job' AND is_deleted = FALSE;

-- ============================================================
-- 4. 통계 확인
-- ============================================================
DO $$
DECLARE
  total_jobs INTEGER;
  hiring_count INTEGER;
  seeking_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_jobs FROM bw_posts WHERE board_type = 'job';
  SELECT COUNT(*) INTO hiring_count FROM bw_posts WHERE board_type = 'job' AND job_type = 'hiring';
  SELECT COUNT(*) INTO seeking_count FROM bw_posts WHERE board_type = 'job' AND job_type = 'seeking';

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✓ Migration 005_job_type.sql completed';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✓ Added job_type column to bw_posts';
  RAISE NOTICE '✓ Migrated % existing job posts', total_jobs;
  RAISE NOTICE '  - 구인 (hiring): %', hiring_count;
  RAISE NOTICE '  - 구직 (seeking): %', seeking_count;
  RAISE NOTICE '✓ Created indexes for performance';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;
