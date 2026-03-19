-- 댓글 멘션(태그) 시스템 추가
-- 실행 날짜: 2026-03-19
-- 설명: @mention 기능으로 답글에서 특정 사용자를 태그할 수 있는 기능 추가

-- ============================================================
-- 1. 멘션 테이블 생성
-- ============================================================
CREATE TABLE IF NOT EXISTS bw_comment_mentions (
    id BIGSERIAL PRIMARY KEY,
    comment_id UUID REFERENCES bw_comments(id) ON DELETE CASCADE,
    mentioned_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    mentioned_username VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE bw_comment_mentions IS '댓글 내 사용자 멘션 추적';
COMMENT ON COLUMN bw_comment_mentions.comment_id IS '멘션이 포함된 댓글 ID';
COMMENT ON COLUMN bw_comment_mentions.mentioned_user_id IS '멘션된 사용자 ID';
COMMENT ON COLUMN bw_comment_mentions.mentioned_username IS '멘션된 사용자명 (스냅샷)';

-- ============================================================
-- 2. 인덱스 추가 (성능 최적화)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_bw_comment_mentions_comment_id
    ON bw_comment_mentions(comment_id);

CREATE INDEX IF NOT EXISTS idx_bw_comment_mentions_user_id
    ON bw_comment_mentions(mentioned_user_id);

CREATE INDEX IF NOT EXISTS idx_bw_comment_mentions_created_at
    ON bw_comment_mentions(created_at DESC);

-- 복합 인덱스: 사용자별 최근 멘션 조회
CREATE INDEX IF NOT EXISTS idx_bw_comment_mentions_user_time
    ON bw_comment_mentions(mentioned_user_id, created_at DESC);

-- ============================================================
-- 3. 중복 방지 제약조건
-- ============================================================
-- 같은 댓글에서 같은 사용자를 여러 번 멘션하는 것을 방지
CREATE UNIQUE INDEX IF NOT EXISTS idx_bw_comment_mentions_unique
    ON bw_comment_mentions(comment_id, mentioned_user_id);

-- ============================================================
-- 4. RLS (Row Level Security) 정책
-- ============================================================
ALTER TABLE bw_comment_mentions ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 멘션 조회 가능
DROP POLICY IF EXISTS "Anyone can view mentions" ON bw_comment_mentions;
CREATE POLICY "Anyone can view mentions"
    ON bw_comment_mentions FOR SELECT
    USING (true);

-- 인증된 사용자가 멘션 생성 가능
DROP POLICY IF EXISTS "Authenticated users can create mentions" ON bw_comment_mentions;
CREATE POLICY "Authenticated users can create mentions"
    ON bw_comment_mentions FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- 5. 트리거: 댓글 삭제 시 멘션도 자동 삭제 (CASCADE로 이미 처리됨)
-- ============================================================
-- CASCADE 옵션으로 자동 처리되므로 별도 트리거 불필요

-- ============================================================
-- 6. 통계 확인
-- ============================================================
DO $$
DECLARE
    total_mentions INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_mentions FROM bw_comment_mentions;

    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✓ Migration 007_comment_mentions.sql completed';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✓ Created bw_comment_mentions table';
    RAISE NOTICE '✓ Total mentions: %', total_mentions;
    RAISE NOTICE '✓ Created indexes for performance';
    RAISE NOTICE '✓ Applied RLS policies';
    RAISE NOTICE '✓ @mention system ready to use';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;
