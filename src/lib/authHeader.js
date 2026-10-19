import { supabase } from "@/lib/supabase";

/**
 * 브라우저 쪽 — 현재 로그인 토큰을 Authorization 헤더로 만든다(로그인 안 했으면 빈 객체).
 * 서버 쪽 짝은 lib/apiAuth.requireUser.
 */
export async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
