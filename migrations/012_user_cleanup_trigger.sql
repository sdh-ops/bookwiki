-- 1. 기존 고아 데이터 정리 (auth.users에 없는 데이터 삭제)
DELETE FROM public.bw_usernames
WHERE id NOT IN (SELECT id FROM auth.users);

-- 2. 트리거 함수 정의
CREATE OR REPLACE FUNCTION public.handle_user_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- bw_usernames 테이블에서 해당 ID 삭제
  DELETE FROM public.bw_usernames WHERE id = OLD.id;
  
  -- bw_admins 테이블에서 해당 이메일 삭제
  DELETE FROM public.bw_admins WHERE email = OLD.email;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. auth.users 테이블에 DELETE 트리거 추가
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
  AFTER DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_delete();
