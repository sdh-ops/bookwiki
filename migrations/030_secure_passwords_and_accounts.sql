-- ============================================================
-- 030_secure_passwords_and_accounts.sql
-- ============================================================
-- 라이브 사이트 무중단 보안 조치 (2단계 중 1단계).
--
-- 이 파일은 "막는 것"과 "대체 수단을 만드는 것"까지만 한다.
-- 실제로 기존 경로를 끊는 작업(bw_usernames 잠금, RLS user_id IS NULL 제거)은
-- 프론트가 새 함수로 전환된 뒤 031 에서 한다. 순서를 바꾸면 사이트가 멈춘다.
--
-- 선행 조건: 게시글·댓글 조회에서 password 를 빼는 프론트 배포가 먼저 나가 있어야 한다
--            (select("*") 가 남아 있으면 아래 8번에서 전부 깨진다).
-- ============================================================

-- ------------------------------------------------------------
-- 0. 되돌릴 수 있게, 지금 정의를 먼저 출력해 둔다
--    SQL Editor 결과창(Messages)에 남으므로 문제가 생기면 이걸로 복원한다.
-- ------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  RAISE NOTICE '=== 변경 전 스냅샷 ===';
  FOR r IN
    SELECT p.oid::regprocedure AS sig, pg_get_functiondef(p.oid) AS def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN ('soft_delete_post', 'soft_delete_comment')
  LOOP
    RAISE NOTICE '--- % ---%', r.sig, E'\n' || r.def;
  END LOOP;

  FOR r IN
    SELECT tablename, policyname, cmd, qual::text AS using_expr
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('bw_posts', 'bw_comments')
  LOOP
    RAISE NOTICE 'POLICY %.% (%) USING %', r.tablename, r.policyname, r.cmd, r.using_expr;
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- 1. pgcrypto 확보 (bcrypt 해시용)
--    Supabase 는 보통 extensions 스키마에 이미 설치돼 있다.
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'extensions') THEN
      CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
    ELSE
      CREATE EXTENSION pgcrypto;
    END IF;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 2. 비회원 비밀번호를 평문 → bcrypt 해시로 전환
--
--    기존 비밀번호는 그대로 쓸 수 있다(해시만 바뀔 뿐 입력값은 동일).
--    이미 해시된 값('$2...')은 건너뛰어 두 번 해시되는 사고를 막는다.
-- ------------------------------------------------------------
SET search_path = public, extensions, pg_temp;

UPDATE public.bw_posts
SET password = crypt(password, gen_salt('bf', 8))
WHERE password IS NOT NULL AND password <> '' AND password NOT LIKE '$2%';

UPDATE public.bw_comments
SET password = crypt(password, gen_salt('bf', 8))
WHERE password IS NOT NULL AND password <> '' AND password NOT LIKE '$2%';

-- 앞으로 들어오는 값도 자동으로 해시한다.
-- 프론트는 계속 평문을 보내지만 DB 에 평문이 남지 않는다 → 프론트 수정 불필요.
CREATE OR REPLACE FUNCTION public.bw_hash_password_on_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  IF NEW.password IS NOT NULL AND NEW.password <> '' AND NEW.password NOT LIKE '$2%' THEN
    NEW.password := crypt(NEW.password, gen_salt('bf', 8));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bw_posts_hash_password ON public.bw_posts;
CREATE TRIGGER trg_bw_posts_hash_password
  BEFORE INSERT OR UPDATE ON public.bw_posts
  FOR EACH ROW EXECUTE FUNCTION public.bw_hash_password_on_write();

DROP TRIGGER IF EXISTS trg_bw_comments_hash_password ON public.bw_comments;
CREATE TRIGGER trg_bw_comments_hash_password
  BEFORE INSERT OR UPDATE ON public.bw_comments
  FOR EACH ROW EXECUTE FUNCTION public.bw_hash_password_on_write();

-- 평문·해시를 모두 받아 대조하는 공용 검사기.
-- 전환 중이거나 어떤 경로로 평문이 남았더라도 로그인이 막히지 않게 한다.
CREATE OR REPLACE FUNCTION public.bw_password_matches(p_stored TEXT, p_input TEXT)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  IF p_stored IS NULL OR p_input IS NULL THEN
    RETURN false;
  END IF;
  IF p_stored LIKE '$2%' THEN
    RETURN crypt(p_input, p_stored) = p_stored;
  END IF;
  RETURN p_stored = p_input;   -- 미전환 평문 대비
END;
$$;

-- ------------------------------------------------------------
-- 4. 삭제 함수를 해시 대조로 교체
--    구조는 022 와 동일하고 비밀번호 비교만 bw_password_matches 로 바꾼다.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.soft_delete_comment(
    p_comment_id UUID,
    p_password   TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_comment      public.bw_comments%ROWTYPE;
    v_caller_uid   UUID;
    v_caller_email TEXT;
BEGIN
    v_caller_uid   := auth.uid();
    v_caller_email := auth.jwt() ->> 'email';

    SELECT * INTO v_comment
    FROM   public.bw_comments
    WHERE  id = p_comment_id AND is_deleted = false
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '댓글을 찾을 수 없습니다.';
    END IF;

    IF EXISTS (SELECT 1 FROM public.bw_admins WHERE email = v_caller_email) THEN
        NULL;
    ELSIF v_caller_uid IS NOT NULL AND v_comment.user_id = v_caller_uid THEN
        NULL;
    ELSIF v_comment.user_id IS NULL THEN
        IF NOT public.bw_password_matches(v_comment.password, p_password) THEN
            RAISE EXCEPTION '비밀번호가 틀렸습니다.';
        END IF;
    ELSE
        RAISE EXCEPTION '삭제 권한이 없습니다.';
    END IF;

    UPDATE public.bw_comments
    SET is_deleted = true,
        deleted_at = NOW(),
        deleted_by = COALESCE(v_caller_email, 'anonymous')
    WHERE id = p_comment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.soft_delete_post(
    p_post_id  UUID,
    p_password TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
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
    WHERE  id = p_post_id AND is_deleted = false
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '게시글을 찾을 수 없습니다.';
    END IF;

    IF EXISTS (SELECT 1 FROM public.bw_admins WHERE email = v_caller_email) THEN
        NULL;
    ELSIF v_caller_uid IS NOT NULL AND v_post.user_id = v_caller_uid THEN
        NULL;
    ELSIF v_post.user_id IS NULL THEN
        IF NOT public.bw_password_matches(v_post.password, p_password) THEN
            RAISE EXCEPTION '비밀번호가 틀렸습니다.';
        END IF;
    ELSE
        RAISE EXCEPTION '삭제 권한이 없습니다.';
    END IF;

    UPDATE public.bw_posts
    SET is_deleted = true,
        deleted_at = NOW(),
        deleted_by = COALESCE(v_caller_email, 'anonymous')
    WHERE id = p_post_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.soft_delete_comment(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_post(UUID, TEXT)    TO anon, authenticated;

-- ------------------------------------------------------------
-- 5. 게시글 수정을 서버에서 검증하도록 함수 신설
--
--    지금은 비회원 글이면 비밀번호도 묻지 않고 누구나 수정할 수 있다.
--    (RLS 의 user_id IS NULL 허용 + 화면에도 비밀번호 입력이 없음)
--    삭제와 같은 기준으로 맞춘다.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bw_update_post(
    p_post_id      UUID,
    p_title        TEXT,
    p_content      TEXT,
    p_board_type   TEXT,
    p_attachments  JSONB DEFAULT NULL,
    p_poll_options JSONB DEFAULT NULL,
    p_password     TEXT  DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_post         public.bw_posts%ROWTYPE;
    v_caller_uid   UUID;
    v_caller_email TEXT;
BEGIN
    IF p_title IS NULL OR btrim(p_title) = '' OR p_content IS NULL OR btrim(p_content) = '' THEN
        RAISE EXCEPTION '제목과 내용을 입력해주세요.';
    END IF;

    v_caller_uid   := auth.uid();
    v_caller_email := auth.jwt() ->> 'email';

    SELECT * INTO v_post
    FROM   public.bw_posts
    WHERE  id = p_post_id AND is_deleted = false
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '게시글을 찾을 수 없습니다.';
    END IF;

    -- 수정은 작성자 본인만. 관리자도 남의 글은 못 고친다(기존 화면 정책과 동일).
    IF v_caller_uid IS NOT NULL AND v_post.user_id = v_caller_uid THEN
        NULL;
    ELSIF v_post.user_id IS NULL THEN
        IF NOT public.bw_password_matches(v_post.password, p_password) THEN
            RAISE EXCEPTION '비밀번호가 틀렸습니다.';
        END IF;
    ELSE
        RAISE EXCEPTION '수정 권한이 없습니다.';
    END IF;

    UPDATE public.bw_posts
    SET title        = p_title,
        content      = p_content,
        board_type   = COALESCE(p_board_type, board_type),
        attachments  = COALESCE(p_attachments, attachments),
        poll_options = p_poll_options
    WHERE id = p_post_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bw_update_post(UUID, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT)
  TO anon, authenticated;

-- ------------------------------------------------------------
-- 6. 계정 조회를 함수로 옮긴다
--
--    지금은 bw_usernames(아이디↔이메일 474건)가 공개 조회라
--    전 회원 이메일 명단을 한 번에 받아갈 수 있다.
--    아래 함수들로 필요한 답만 내주고, 테이블 자체는 031 에서 잠근다.
-- ------------------------------------------------------------

-- 로그인용: 아이디 하나에 대한 이메일만 반환 (목록 조회 불가)
CREATE OR REPLACE FUNCTION public.bw_login_email(p_username TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT email FROM public.bw_usernames
  WHERE username = lower(btrim(p_username))
  LIMIT 1;
$$;

-- 가입 시 아이디 중복확인 (존재 여부만)
CREATE OR REPLACE FUNCTION public.bw_username_taken(p_username TEXT)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bw_usernames WHERE username = lower(btrim(p_username))
  );
$$;

-- 가입 시 이메일 중복확인 (존재 여부만)
CREATE OR REPLACE FUNCTION public.bw_email_taken(p_email TEXT)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bw_usernames WHERE email = lower(btrim(p_email))
  );
$$;

-- 아이디 찾기: 마스킹을 서버에서 한다.
-- 지금은 전체 아이디를 받아 브라우저에서 가리기 때문에 응답에 원본이 그대로 실린다.
CREATE OR REPLACE FUNCTION public.bw_find_username_masked(p_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_username TEXT;
BEGIN
  SELECT username INTO v_username
  FROM public.bw_usernames
  WHERE email = lower(btrim(p_email))
  LIMIT 1;

  IF v_username IS NULL THEN
    RETURN NULL;
  END IF;

  IF length(v_username) <= 2 THEN
    RETURN left(v_username, 1) || repeat('*', greatest(length(v_username) - 1, 1));
  END IF;

  RETURN left(v_username, 2) || repeat('*', length(v_username) - 2);
END;
$$;

-- 마이페이지: 로그인한 본인의 아이디만
CREATE OR REPLACE FUNCTION public.bw_my_username()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT u.username
  FROM public.bw_usernames u
  WHERE u.email = lower(auth.jwt() ->> 'email')
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.bw_login_email(TEXT)           FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bw_username_taken(TEXT)        FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bw_email_taken(TEXT)           FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bw_find_username_masked(TEXT)  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bw_my_username()               FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.bw_login_email(TEXT)          TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bw_username_taken(TEXT)       TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bw_email_taken(TEXT)          TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bw_find_username_masked(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bw_my_username()              TO authenticated;

-- ------------------------------------------------------------
-- 7. HOT 승격을 방문자 브라우저에서 크론으로 옮긴다
--
--    지금은 홈을 열 때마다 방문자가 ①최근 7일 글 400건 ②HOT 아닌 글 전체를
--    받아온 뒤 UPDATE 까지 실행한다. 하루 수백 번 같은 일을 반복한다.
--    승격 규칙은 기존 프론트 로직 그대로 옮긴다.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bw_promote_hot_posts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_count integer;
BEGIN
  WITH promoted AS (
    UPDATE public.bw_posts p
    SET is_hot = true
    WHERE p.is_hot = false
      AND p.is_deleted = false
      AND COALESCE(p.admin_hot_override, false) = false
      AND (COALESCE(p.view_count, 0) + COALESCE(p.comment_count, 0) * 5)
          >= CASE
               WHEN p.board_type = 'free' AND p.title LIKE '%[잡담]%' THEN 300
               WHEN p.board_type IN ('job', 'free')                  THEN 200
               ELSE 100
             END
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM promoted;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.bw_promote_hot_posts() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bw-hot-promote') THEN
      PERFORM cron.unschedule('bw-hot-promote');
    END IF;
    PERFORM cron.schedule('bw-hot-promote', '*/20 * * * *',
                          $cron$SELECT public.bw_promote_hot_posts()$cron$);
    RAISE NOTICE 'HOT 승격 크론 등록됨 (20분마다)';
  ELSE
    RAISE WARNING 'pg_cron 이 없어 크론을 등록하지 못했습니다 — 홈 화면 코드를 아직 제거하지 마세요.';
  END IF;
END $$;

-- 첫 실행은 지금 한 번 돌려 밀린 승격을 반영한다
SELECT public.bw_promote_hot_posts() AS promoted_now;

-- ------------------------------------------------------------
-- 8. password 컬럼을 브라우저에서 읽을 수 없게 한다  ★마지막 단계★
--    앞의 모든 단계가 성공한 뒤에만 적용되도록 일부러 맨 끝에 뒀다.
--    (중간에서 실패하면 권한만 걷힌 채 사이트가 멈추기 때문)
--
--    PostgreSQL 은 테이블 단위 SELECT 권한이 있으면 컬럼 단위 회수가 먹지 않는다.
--    그래서 테이블 권한을 걷고 password 를 뺀 나머지 컬럼만 다시 부여한다.
--    ⚠️ 앞으로 컬럼을 추가하면 여기서도 GRANT 해야 화면에 보인다.
-- ------------------------------------------------------------
DO $$
DECLARE
  t    text;
  cols text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bw_posts', 'bw_comments'] LOOP
    SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
      INTO cols
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = t AND column_name <> 'password';

    EXECUTE format('REVOKE SELECT ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT (%s) ON public.%I TO anon, authenticated', cols, t);
    RAISE NOTICE '% : password 제외 % 개 컬럼만 조회 허용', t, array_length(string_to_array(cols, ','), 1);
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- 9. PostgREST 스키마 캐시 갱신 (권한 변경 반영)
-- ------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
