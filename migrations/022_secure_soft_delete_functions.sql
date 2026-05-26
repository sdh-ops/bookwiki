-- ============================================================
-- 022_secure_soft_delete_functions.sql
-- ============================================================
-- 비회원(익명) 댓글/게시글 삭제 시 RLS 오류 근본 수정
-- 원인: soft-delete(UPDATE is_deleted=true) 후 row가 SELECT 정책을
--       통과하지 못해 PostgreSQL이 "new row violates RLS" 반환
-- 해결: SECURITY DEFINER 함수로 RLS 우회 + 함수 내부에서 권한 직접 검사
-- ============================================================

-- ============================================================
-- 1. soft_delete_comment
-- ============================================================
CREATE OR REPLACE FUNCTION public.soft_delete_comment(
    p_comment_id UUID,
    p_password    TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_comment     public.bw_comments%ROWTYPE;
    v_caller_uid  UUID;
    v_caller_email TEXT;
BEGIN
    v_caller_uid   := auth.uid();
    v_caller_email := auth.jwt() ->> 'email';

    -- 대상 row 취득 (FOR UPDATE로 동시 삭제 방지)
    SELECT * INTO v_comment
    FROM   public.bw_comments
    WHERE  id = p_comment_id
      AND  is_deleted = false
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '댓글을 찾을 수 없습니다.';
    END IF;

    -- 권한 검사
    IF EXISTS (
        SELECT 1 FROM public.bw_admins WHERE email = v_caller_email
    ) THEN
        -- 관리자: 항상 허용
        NULL;

    ELSIF v_caller_uid IS NOT NULL
      AND v_comment.user_id = v_caller_uid THEN
        -- 인증 회원 본인: 허용
        NULL;

    ELSIF v_comment.user_id IS NULL THEN
        -- 비회원 댓글: 비밀번호 검증
        IF p_password IS NULL OR v_comment.password IS DISTINCT FROM p_password THEN
            RAISE EXCEPTION '비밀번호가 틀렸습니다.';
        END IF;

    ELSE
        RAISE EXCEPTION '삭제 권한이 없습니다.';
    END IF;

    -- 소프트 삭제 실행
    UPDATE public.bw_comments
    SET
        is_deleted = true,
        deleted_at = NOW(),
        deleted_by = COALESCE(v_caller_email, 'anonymous')
    WHERE id = p_comment_id;
END;
$$;

-- ============================================================
-- 2. soft_delete_post
-- ============================================================
CREATE OR REPLACE FUNCTION public.soft_delete_post(
    p_post_id  UUID,
    p_password TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_post         public.bw_posts%ROWTYPE;
    v_caller_uid   UUID;
    v_caller_email TEXT;
BEGIN
    v_caller_uid   := auth.uid();
    v_caller_email := auth.jwt() ->> 'email';

    SELECT * INTO v_post
    FROM   public.bw_posts
    WHERE  id = p_post_id
      AND  is_deleted = false
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '게시글을 찾을 수 없습니다.';
    END IF;

    -- 권한 검사
    IF EXISTS (
        SELECT 1 FROM public.bw_admins WHERE email = v_caller_email
    ) THEN
        -- 관리자: 항상 허용
        NULL;

    ELSIF v_caller_uid IS NOT NULL
      AND v_post.user_id = v_caller_uid THEN
        -- 인증 회원 본인: 허용
        NULL;

    ELSIF v_post.user_id IS NULL THEN
        -- 비회원 게시글: 비밀번호 검증
        IF p_password IS NULL OR v_post.password IS DISTINCT FROM p_password THEN
            RAISE EXCEPTION '비밀번호가 틀렸습니다.';
        END IF;

    ELSE
        RAISE EXCEPTION '삭제 권한이 없습니다.';
    END IF;

    -- 소프트 삭제 실행
    UPDATE public.bw_posts
    SET
        is_deleted = true,
        deleted_at = NOW(),
        deleted_by = COALESCE(v_caller_email, 'anonymous')
    WHERE id = p_post_id;
END;
$$;

-- ============================================================
-- 3. anon / authenticated 역할에 실행 권한 부여
-- ============================================================
GRANT EXECUTE ON FUNCTION public.soft_delete_comment(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_post(UUID, TEXT)    TO anon, authenticated;
