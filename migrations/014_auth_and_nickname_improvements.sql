-- 1. 중복된 닉네임을 찾아서 (1), (2)... 형식으로 이름 변경
WITH duplicates AS (
    SELECT id, nickname,
           row_number() OVER (PARTITION BY nickname ORDER BY created_at) as rn
    FROM public.profiles
    WHERE nickname IN (
        SELECT nickname 
        FROM public.profiles 
        GROUP BY nickname 
        HAVING COUNT(*) > 1
    )
)
UPDATE public.profiles p
SET nickname = p.nickname || '(' || (d.rn - 1) || ')'
FROM duplicates d
WHERE p.id = d.id AND d.rn > 1;

-- 2. 닉네임 컬럼에 UNIQUE 제약 조건 추가
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_nickname_key UNIQUE (nickname);

-- 3. Auth 트리거 강화 (중복 닉네임 시 가입 차단)
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_username TEXT;
  v_email TEXT;
  v_nickname TEXT;
BEGIN
  v_username := LOWER(NEW.raw_user_meta_data->>'username');
  v_email := LOWER(NEW.email);
  v_nickname := NEW.raw_user_meta_data->>'nickname';

  -- Insert into bw_usernames if metadata exists
  IF (v_username IS NOT NULL) THEN
    INSERT INTO public.bw_usernames (id, username, email)
    VALUES (NEW.id, v_username, v_email)
    ON CONFLICT (id) DO UPDATE SET 
      username = EXCLUDED.username,
      email = EXCLUDED.email;
  END IF;

  -- Insert/Update profiles
  IF (v_nickname IS NOT NULL) THEN
    -- Check if nickname already exists for another user to provide a better error
    IF EXISTS (SELECT 1 FROM public.profiles WHERE nickname = v_nickname AND id != NEW.id) THEN
        RAISE EXCEPTION '이미 사용 중인 닉네임입니다.';
    END IF;

    INSERT INTO public.profiles (id, nickname)
    VALUES (NEW.id, v_nickname)
    ON CONFLICT (id) DO UPDATE SET nickname = EXCLUDED.nickname;
  END IF;
  
  RETURN NEW;
END;
$function$;
