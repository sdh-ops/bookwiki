/**
 * 방문 기기 판별 (pc / mobile / tablet).
 *
 * 광고 리포트에서 PC·모바일 유입을 나누는 기준값이라 서버·클라이언트 어디서든
 * 같은 규칙을 쓰도록 한 곳에 모아둔다. DB CHECK 제약과 값이 일치해야 한다
 * (migrations/026 — 'pc' | 'mobile' | 'tablet' | 'unknown').
 */
export function getDeviceType() {
  if (typeof navigator === "undefined") return "unknown";

  const ua = navigator.userAgent || "";

  // iPadOS 13+ 는 UA 를 Macintosh 로 위장한다. 터치 포인트로만 구분 가능.
  const isIpadOS =
    /Macintosh/.test(ua) &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1;

  // 태블릿을 먼저 걸러낸다 — 안드로이드 태블릿 UA 에는 'Mobile' 이 없다.
  if (isIpadOS || /iPad|Tablet|PlayBook|Silk|Android(?!.*Mobile)/i.test(ua)) {
    return "tablet";
  }

  // 최신 브라우저는 UA-CH 로 정확히 답해준다.
  const uaData = navigator.userAgentData;
  if (uaData && typeof uaData.mobile === "boolean") {
    return uaData.mobile ? "mobile" : "pc";
  }

  if (/Mobi|iPhone|iPod|Android|Windows Phone|IEMobile|BlackBerry|Opera Mini/i.test(ua)) {
    return "mobile";
  }

  return "pc";
}
