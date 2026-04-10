-- 1. HOT 게시판 로직 개편을 위한 컬럼 및 트리거 생성
ALTER TABLE IF EXISTS public.bw_posts 
ADD COLUMN IF NOT EXISTS is_hot BOOLEAN DEFAULT false;

-- 기존 데이터 중 HOT 조건을 만족하는 게시글 is_hot 처리
UPDATE public.bw_posts
SET is_hot = true
WHERE is_hot = false AND (
  (board_type = 'job' AND (COALESCE(view_count, 0) + COALESCE(comment_count, 0) * 10) >= 200)
  OR
  (board_type != 'job' AND (COALESCE(view_count, 0) + COALESCE(comment_count, 0) * 10) >= 100)
);

-- 트리거 생성: 게시글 업데이트 시 HOT 점수 계산 후 갱신
CREATE OR REPLACE FUNCTION public.check_and_update_hot_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT NEW.is_hot THEN
        IF NEW.board_type = 'job' AND (COALESCE(NEW.view_count, 0) + COALESCE(NEW.comment_count, 0) * 10) >= 200 THEN
            NEW.is_hot := true;
        ELSIF NEW.board_type != 'job' AND (COALESCE(NEW.view_count, 0) + COALESCE(NEW.comment_count, 0) * 10) >= 100 THEN
            NEW.is_hot := true;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_hot_status ON public.bw_posts;
CREATE TRIGGER trigger_update_hot_status
BEFORE UPDATE OF view_count, comment_count ON public.bw_posts
FOR EACH ROW
EXECUTE FUNCTION public.check_and_update_hot_status();

-- 2. 무기명 투표 (Anonymous Voting) 관련 스키마 추가
ALTER TABLE IF EXISTS public.bw_posts 
ADD COLUMN IF NOT EXISTS poll_options JSONB DEFAULT '[]'::jsonb;
-- poll_options format: [{"id": 1, "text": "선택지 1"}]

CREATE TABLE IF NOT EXISTS public.bw_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES public.bw_posts(id) ON DELETE CASCADE,
    option_id INTEGER NOT NULL,
    session_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for checking duplicate votes efficiently
CREATE UNIQUE INDEX IF NOT EXISTS idx_bw_votes_post_session
ON public.bw_votes(post_id, session_id);
