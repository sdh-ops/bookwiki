-- 북위키 개선사항 DB 마이그레이션
-- 실행 날짜: 2026-03-18
-- 설명: 16가지 개선사항을 위한 데이터베이스 스키마 변경

-- ============================================================
-- 1. bw_posts 테이블에 soft delete 컬럼 추가 (개선사항 6)
-- ============================================================
ALTER TABLE bw_posts
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(255);

-- 인덱스 추가 (삭제되지 않은 게시글 조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_bw_posts_is_deleted ON bw_posts(is_deleted);

-- ============================================================
-- 2. bw_posts 테이블에 구인구직 추가 필드 (개선사항 16)
-- ============================================================
ALTER TABLE bw_posts
ADD COLUMN IF NOT EXISTS job_category VARCHAR(50),     -- 직군: editing, marketing, design, production, sales, writer, other
ADD COLUMN IF NOT EXISTS experience_level VARCHAR(50), -- 경력: entry, 1-3, 3-5, 5-10, 10+
ADD COLUMN IF NOT EXISTS deadline DATE,                -- 마감일
ADD COLUMN IF NOT EXISTS contact_info VARCHAR(200);    -- 연락처

-- 인덱스 추가 (구인구직 게시판 필터링 성능 향상)
CREATE INDEX IF NOT EXISTS idx_bw_posts_job_category ON bw_posts(job_category) WHERE board_type = 'job';
CREATE INDEX IF NOT EXISTS idx_bw_posts_deadline ON bw_posts(deadline) WHERE board_type = 'job';

-- ============================================================
-- 3. profiles 테이블에 닉네임 변경 추적 필드 (개선사항 11)
-- ============================================================
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS nickname_updated_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS nickname_change_count INTEGER DEFAULT 0;

-- ============================================================
-- 4. 닉네임 변경 히스토리 테이블 생성 (개선사항 11)
-- ============================================================
CREATE TABLE IF NOT EXISTS bw_nickname_history (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  old_nickname VARCHAR(50),
  new_nickname VARCHAR(50) NOT NULL,
  changed_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_bw_nickname_history_user_id ON bw_nickname_history(user_id);
CREATE INDEX IF NOT EXISTS idx_bw_nickname_history_changed_at ON bw_nickname_history(changed_at);

-- ============================================================
-- 5. 투표 기능을 위한 테이블 생성 (개선사항 2)
-- ============================================================
CREATE TABLE IF NOT EXISTS bw_poll_votes (
  id BIGSERIAL PRIMARY KEY,
  poll_id VARCHAR(100) NOT NULL,         -- 투표 고유 ID (게시글 내 poll node ID)
  post_id UUID REFERENCES bw_posts(id) ON DELETE CASCADE,
  option_index INTEGER NOT NULL,          -- 선택한 옵션 인덱스 (0부터 시작)
  user_id UUID REFERENCES auth.users(id), -- 회원인 경우
  ip_address VARCHAR(45),                 -- 비회원인 경우 (IPv4/IPv6)
  created_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_bw_poll_votes_poll_id ON bw_poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_bw_poll_votes_post_id ON bw_poll_votes(post_id);

-- 중복 투표 방지를 위한 유니크 제약조건
-- 회원: user_id 기준
-- 비회원: IP 주소 기준
CREATE UNIQUE INDEX IF NOT EXISTS idx_bw_poll_votes_user_unique
  ON bw_poll_votes(poll_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bw_poll_votes_ip_unique
  ON bw_poll_votes(poll_id, ip_address)
  WHERE user_id IS NULL AND ip_address IS NOT NULL;

-- ============================================================
-- 6. 기존 데이터 무결성 확인 및 기본값 설정
-- ============================================================

-- 기존 게시글의 is_deleted를 FALSE로 설정 (이미 DEFAULT FALSE이지만 명시적으로)
UPDATE bw_posts SET is_deleted = FALSE WHERE is_deleted IS NULL;

-- 기존 프로필의 nickname_change_count를 0으로 설정
UPDATE profiles SET nickname_change_count = 0 WHERE nickname_change_count IS NULL;

-- ============================================================
-- 7. 권한 설정 (RLS - Row Level Security)
-- ============================================================

-- bw_nickname_history: 본인 히스토리만 조회 가능
ALTER TABLE bw_nickname_history ENABLE ROW LEVEL SECURITY;

-- 기존 정책이 있으면 삭제 후 생성
DROP POLICY IF EXISTS "Users can view own nickname history" ON bw_nickname_history;
CREATE POLICY "Users can view own nickname history"
  ON bw_nickname_history FOR SELECT
  USING (auth.uid() = user_id);

-- bw_poll_votes: 투표 결과는 모두 조회 가능, 투표는 인증된 사용자 또는 비회원
ALTER TABLE bw_poll_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view poll votes" ON bw_poll_votes;
CREATE POLICY "Anyone can view poll votes"
  ON bw_poll_votes FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert poll votes" ON bw_poll_votes;
CREATE POLICY "Users can insert poll votes"
  ON bw_poll_votes FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- 완료
-- ============================================================

-- 마이그레이션 완료 로그
DO $$
BEGIN
  RAISE NOTICE '✓ DB Migration 001_improvements.sql completed successfully';
  RAISE NOTICE '✓ Added soft delete columns to bw_posts';
  RAISE NOTICE '✓ Added job posting fields to bw_posts';
  RAISE NOTICE '✓ Added nickname tracking to profiles';
  RAISE NOTICE '✓ Created bw_nickname_history table';
  RAISE NOTICE '✓ Created bw_poll_votes table';
  RAISE NOTICE '✓ Applied indexes and RLS policies';
END $$;
