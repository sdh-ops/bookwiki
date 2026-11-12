/**
 * 붙여 넣은 글 속 바깥 이미지 다루기.
 *
 * GitHub·노션·구글 문서 같은 곳에서 화면을 복사해 붙이면 이미지가 파일이 아니라
 * 그 사이트의 주소(<img src>)로 들어온다. 그중 서명 붙은 임시 주소(S3 X-Amz-Expires 등)는
 * 몇 분 뒤 만료돼 글에서 깨진다 — 2026-11-11 위키북스 글 이미지 4장이 GitHub 임시 주소(5분)라 전부 깨졌다.
 * 그래서 붙여 넣을 때 우리 저장소로 옮기고, 못 옮긴 임시 주소는 저장 전에 막는다.
 */

const OWN_STORAGE_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL || ""}/storage/v1/object/public/post-uploads/`;

// 주소 자체가 곧 사라지는 곳
const TEMPORARY_HOSTS = [
  /^github-production-user-asset-[\w-]+\.s3\.amazonaws\.com$/i,
  /^private-user-images\.githubusercontent\.com$/i,
];

// 서명·만료가 붙은 주소(S3·구글 클라우드·CloudFront)
const SIGNED_PARAMS = ["x-amz-signature", "x-amz-expires", "x-goog-signature", "x-goog-expires"];

export function isOwnStorageUrl(src) {
  return typeof src === "string" && OWN_STORAGE_PREFIX.length > 40 && src.startsWith(OWN_STORAGE_PREFIX);
}

export function isTemporaryImageUrl(src) {
  let url;
  try {
    url = new URL(src);
  } catch {
    return false;
  }
  if (TEMPORARY_HOSTS.some((re) => re.test(url.hostname))) return true;
  const keys = [...url.searchParams.keys()].map((k) => k.toLowerCase());
  if (SIGNED_PARAMS.some((p) => keys.includes(p))) return true;
  // CloudFront 서명 주소: Expires + Signature 짝
  return keys.includes("expires") && keys.includes("signature");
}

/** 우리 저장소 밖 http(s) 이미지인가 */
export function isExternalImageUrl(src) {
  return typeof src === "string" && /^https?:\/\//i.test(src) && !isOwnStorageUrl(src);
}

/** HTML 안 <img src> 중 임시 주소 목록 */
export function findTemporaryImages(html) {
  if (!html) return [];
  const srcs = [];
  const re = /<img\b[^>]*?\bsrc\s*=\s*("([^"]*)"|'([^']*)')/gi;
  let m;
  while ((m = re.exec(html))) {
    const src = (m[2] ?? m[3] ?? "").replace(/&amp;/g, "&");
    if (isTemporaryImageUrl(src)) srcs.push(src);
  }
  return srcs;
}

const EXT_BY_TYPE = { "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp" };

/**
 * 바깥 이미지를 브라우저에서 받아 File 로 만든다. 사이트가 CORS 를 안 열어 주면 실패한다(null).
 * 서버 중계는 쓰지 않는다 — Vercel 무료 한도와 남의 중계기로 쓰일 위험 때문(api/download 참고).
 */
export async function fetchImageAsFile(src) {
  try {
    const res = await fetch(src, { mode: "cors", credentials: "omit" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const ext = EXT_BY_TYPE[blob.type];
    if (!ext) return null;
    return new File([blob], `pasted.${ext}`, { type: blob.type });
  } catch {
    return null;
  }
}
