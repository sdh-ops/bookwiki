import { supabase } from "./supabase";

/**
 * 로그인한 본인의 아이디(username).
 *
 * user_metadata.username 은 가입 시점 사본이라 초기 계정 등에서 비어 있다.
 * 정본은 bw_usernames 이지만 이 테이블은 전 회원의 아이디·이메일이 들어 있어
 * 공개 조회를 막았다. 그래서 본인 것만 돌려주는 서버 함수를 쓴다.
 *
 * 함수가 아직 없는 배포 시점(마이그레이션 전)을 위해 테이블 조회로 물러선다.
 * 테이블이 잠긴 뒤에는 이 폴백이 조용히 실패하고 빈 문자열이 되므로 화면만 비고 끝난다.
 */
export async function fetchMyUsername(user) {
  const fromMetadata = user?.user_metadata?.username;
  if (fromMetadata) return fromMetadata;

  const { data, error } = await supabase.rpc("bw_my_username");
  if (!error && data) return data;

  if (!user?.email) return "";
  const { data: row } = await supabase
    .from("bw_usernames")
    .select("username")
    .eq("email", user.email.toLowerCase())
    .maybeSingle();
  return row?.username || "";
}

/**
 * 관리자 회원 목록용 id→이메일 사전.
 * 관리자 여부는 서버 함수가 직접 판정한다.
 */
export async function fetchAccountDirectory() {
  const { data, error } = await supabase.rpc("bw_admin_account_directory");
  if (!error && Array.isArray(data)) return data;

  // 마이그레이션 전 폴백
  const { data: rows } = await supabase.from("bw_usernames").select("id, email");
  return rows || [];
}
