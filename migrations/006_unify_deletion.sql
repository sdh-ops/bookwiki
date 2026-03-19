-- 댓글 테이블 삭제 통일: is_hidden → is_deleted
-- 실행 날짜: 2026-03-19
-- 설명: 게시글과 댓글의 삭제 방식을 is_deleted로 통일하여 일관성 확보

-- ============================================================
-- 1. bw_comments 테이블에 is_deleted 컬럼 추가
-- ============================================================
ALTER TABLE bw_comments
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(255);

COMMENT ON COLUMN bw_comments.is_deleted IS '소프트 삭제 여부 (TRUE=삭제됨)';
COMMENT ON COLUMN bw_comments.deleted_at IS '삭제 시간';
COMMENT ON COLUMN bw_comments.deleted_by IS '삭제한 사용자 (이메일 또는 IP)';

-- ============================================================
-- 2. 기존 is_hidden 데이터를 is_deleted로 마이그레이션
-- ============================================================
UPDATE bw_comments
SET
    is_deleted = is_hidden,
    deleted_at = CASE
        WHEN is_hidden = TRUE THEN NOW()
        ELSE NULL
    END
WHERE is_hidden IS NOT NULL;

-- ============================================================
-- 3. 인덱스 추가 (조회 성능 향상)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_bw_comments_is_deleted
    ON bw_comments(is_deleted);

CREATE INDEX IF NOT EXISTS idx_bw_comments_post_id_not_deleted
    ON bw_comments(post_id)
    WHERE is_deleted = FALSE;

-- ============================================================
-- 4. RLS 정책 업데이트
-- ============================================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Anyone can view comments" ON bw_comments;

-- 새 정책: 삭제되지 않은 댓글만 일반 사용자가 조회 가능
CREATE POLICY "Anyone can view non-deleted comments"
    ON bw_comments FOR SELECT
    USING (is_deleted = FALSE);

-- 관리자는 삭제된 댓글도 조회 가능 (별도 쿼리에서 처리)

-- ============================================================
-- 5. is_hidden 컬럼 제거 (선택 사항 - 안전을 위해 주석 처리)
-- ============================================================
-- 데이터 마이그레이션 검증 후 실행 권장
-- ALTER TABLE bw_comments DROP COLUMN IF EXISTS is_hidden;

-- ============================================================
-- 6. 통계 확인
-- ============================================================
DO $$
DECLARE
    total_comments INTEGER;
    deleted_count INTEGER;
    active_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_comments FROM bw_comments;
    SELECT COUNT(*) INTO deleted_count FROM bw_comments WHERE is_deleted = TRUE;
    SELECT COUNT(*) INTO active_count FROM bw_comments WHERE is_deleted = FALSE;

    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✓ Migration 006_unify_deletion.sql completed';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✓ Added is_deleted column to bw_comments';
    RAISE NOTICE '✓ Migrated is_hidden → is_deleted';
    RAISE NOTICE '✓ Total comments: %', total_comments;
    RAISE NOTICE '  - Active: %', active_count;
    RAISE NOTICE '  - Deleted: %', deleted_count;
    RAISE NOTICE '✓ Updated RLS policies';
    RAISE NOTICE '✓ Created indexes for performance';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;
