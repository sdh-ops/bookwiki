-- ============================================================
-- 031_lock_usernames_and_tighten_rls.sql
-- ============================================================
-- 라이브 보안 조치 2단계(마지막). 여기서 실제로 기존 경로를 끊는다.
--
-- 선행 조건 (지키지 않으면 사이트가 멈춘다):
--   1) 030 이 이미 적용돼 있을 것 (대체 함수들이 존재해야 함)
--   2) 로그인·아이디찾기·마이페이지·회원관리·글수정이 새 함수를 쓰는 배포가
--      먼저 나가 있을 것
--
-- 막는 것 두 가지:
--   A. bw_usernames 공개 조회 — 전 회원 아이디·이메일 474건이 그대로 조회됐다
--   B. RLS 의 "user_id IS NULL 이면 누구나 수정 가능" — 비회원 글·댓글을
--      로그인도 안 한 사람이 고칠 수 있었다
-- ============================================================

-- ------------------------------------------------------------
-- 0. 변경 전 상태를 결과창에 남긴다 (복원용)
-- ------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  RAISE NOTICE '=== 변경 전 정책 ===';
  FOR r IN
    SELECT tablename, policyname, cmd, qual::text AS using_expr, with_check::text AS check_expr
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('bw_posts', 'bw_comments', 'bw_usernames')
    ORDER BY tablename, cmd
  LOOP
    RAISE NOTICE '%.% (%) USING % | CHECK %',
      r.tablename, r.policyname, r.cmd, r.using_expr, r.check_expr;
  END LOOP;

  RAISE NOTICE '=== bw_usernames 권한 ===';
  FOR r IN
    SELECT grantee, privilege_type
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name = 'bw_usernames'
  LOOP
    RAISE NOTICE '% : %', r.grantee, r.privilege_type;
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- 1. 관리자 회원 목록용 함수 (잠그기 전에 대체 수단부터 만든다)
--    회원 관리 화면이 id→이메일 사전을 필요로 한다.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bw_admin_account_directory()
RETURNS TABLE (id UUID, username TEXT, email TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.bw_admins WHERE email = (auth.jwt() ->> 'email')
  ) THEN
    RAISE EXCEPTION '관리자만 조회할 수 있습니다.';
  END IF;

  RETURN QUERY
    SELECT u.id, u.username, u.email FROM public.bw_usernames u;
END;
$$;

REVOKE ALL ON FUNCTION public.bw_admin_account_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bw_admin_account_directory() TO authenticated;

-- ------------------------------------------------------------
-- 2. RLS 조이기 — 비회원 글·댓글을 아무나 수정하지 못하게
--
--    수정은 이제 bw_update_post(SECURITY DEFINER)가 비밀번호를 검증해서 처리하고,
--    삭제는 이미 soft_delete_post/comment 가 담당한다.
--    두 함수 모두 정의자 권한으로 돌기 때문에 아래 정책 변경의 영향을 받지 않는다.
--
--    조회수 증가(increment_view_count)도 SECURITY DEFINER 라 그대로 동작한다.
--    HOT 승격은 030 에서 크론(bw_promote_hot_posts)으로 옮겨 두었다.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "bw_posts_update" ON public.bw_posts;
CREATE POLICY "bw_posts_update" ON public.bw_posts
FOR UPDATE
USING (
    (auth.uid() = user_id)
    OR (EXISTS (SELECT 1 FROM public.bw_admins WHERE email = (SELECT auth.jwt() ->> 'email')))
)
-- WITH CHECK 는 열어 둔다. 탈퇴 시 본인 글의 user_id 를 NULL 로 바꾸는 처리가 있다.
WITH CHECK (true);

DROP POLICY IF EXISTS "bw_comments_update" ON public.bw_comments;
CREATE POLICY "bw_comments_update" ON public.bw_comments
FOR UPDATE
USING (
    (auth.uid() = user_id)
    OR (EXISTS (SELECT 1 FROM public.bw_admins WHERE email = (SELECT auth.jwt() ->> 'email')))
)
WITH CHECK (true);

-- ------------------------------------------------------------
-- 3. bw_usernames 공개 조회 차단  ★마지막 단계★
--
--    로그인·중복확인·아이디찾기·마이페이지·회원관리는 030/031 의 함수들이
--    대신 답한다. 테이블 직접 조회만 닫는다.
--    INSERT/UPDATE 는 원래 RLS 로 막혀 있고 가입 시 트리거가 처리하므로 건드리지 않는다.
-- ------------------------------------------------------------
REVOKE SELECT ON public.bw_usernames FROM anon, authenticated;

DROP POLICY IF EXISTS "bw_usernames_select" ON public.bw_usernames;
DROP POLICY IF EXISTS "Public read access" ON public.bw_usernames;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.bw_usernames;

-- ------------------------------------------------------------
-- 4. 확인용 출력
-- ------------------------------------------------------------
DO $$
DECLARE v_cnt int;
BEGIN
  SELECT count(*) INTO v_cnt
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public' AND table_name = 'bw_usernames'
    AND grantee IN ('anon', 'authenticated') AND privilege_type = 'SELECT';
  RAISE NOTICE 'bw_usernames 공개 SELECT 권한 남은 개수: % (0 이어야 정상)', v_cnt;
END $$;

NOTIFY pgrst, 'reload schema';
