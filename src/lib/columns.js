/**
 * 조회 컬럼 정본.
 *
 * bw_posts / bw_comments 의 `password` 는 비회원이 글·댓글을 지울 때 쓰는 값이고,
 * 검증은 서버 함수(soft_delete_post / soft_delete_comment)가 전담한다.
 * 따라서 브라우저로 내려보낼 이유가 전혀 없다 — select("*") 로 긁으면
 * 목록 API 응답에 남의 비밀번호가 그대로 실려 나간다.
 *
 * 여기 목록에서 password 만 빼두고, 모든 조회가 이 상수를 쓰도록 통일한다.
 * DB 에 컬럼을 추가하면 이 파일에도 추가해야 화면에서 보인다.
 */
export const POST_COLUMNS = [
  "id",
  "created_at",
  "title",
  "content",
  "author",
  "board_type",
  "view_count",
  "is_notice",
  "comment_count",
  "user_id",
  "source_url",
  "is_auto",
  "is_deleted",
  "job_category",
  "experience",
  "deadline",
  "contact",
  "poll_data",
  "deleted_at",
  "deleted_by",
  "experience_level",
  "contact_info",
  "job_type",
  "preview_url",
  "attachments",
  "is_hot",
  "poll_options",
  "admin_hot_override",
].join(", ");

export const COMMENT_COLUMNS = [
  "id",
  "post_id",
  "created_at",
  "content",
  "author",
  "is_hidden",
  "user_id",
  "parent_id",
  "is_deleted",
  "deleted_at",
  "deleted_by",
].join(", ");
