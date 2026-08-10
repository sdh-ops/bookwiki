import { supabase } from "./supabase";

/**
 * 로그인한 본인의 아이디(username)를 가져온다.
 *
 * user_metadata.username 은 가입 시점에 복사해 둔 사본이라, 초기에 만들어진 계정 등
 * 비어 있는 경우가 있다. 아이디의 정본은 bw_usernames 이므로 사본이 비면 여기서 읽는다.
 *
 * ⚠️ bw_usernames 는 전 회원의 아이디·이메일이 들어 있는 테이블이라 곧 공개 조회를
 *    막을 예정이다. 그때 이 함수 내부만 서버 함수 호출로 바꾸면 되도록 한 곳에 모아둔다.
 */
export async function fetchMyUsername(user) {
  const fromMetadata = user?.user_metadata?.username;
  if (fromMetadata) return fromMetadata;
  if (!user?.email) return "";

  const { data, error } = await supabase
    .from("bw_usernames")
    .select("username")
    .eq("email", user.email.toLowerCase())
    .maybeSingle();

  if (error) {
    console.error("[account] username lookup error:", error.message);
    return "";
  }
  return data?.username || "";
}
