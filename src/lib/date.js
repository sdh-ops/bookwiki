const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * 'YYYY-MM-DD' 의 요일 한 글자. 형식이 다르면 null.
 *
 * 문자열을 Date 에 그대로 넘기면 UTC 자정으로 파싱돼 타임존에 따라 하루가 밀 수 있으므로
 * 연·월·일을 뜯어 로컬 날짜로 만든다 (시각 성분이 없는 '날짜'는 이렇게 다뤄야 안전).
 */
export function weekdayOf(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || "").trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return null;
  return WEEKDAYS[d.getDay()];
}

/**
 * 'YYYY-MM-DD' → '2026-08-10 (월)'.
 *
 * 정확히 날짜 형식일 때만 붙인다. 주간('2026-08-10 (주간)')·월간('2026-08') 라벨은
 * 요일 개념이 없으므로 그대로 통과시킨다.
 */
export function withWeekday(value) {
  const w = weekdayOf(value);
  return w ? `${value} (${w})` : value;
}

/** 짧은 표기 — 차트 축처럼 폭이 좁은 곳: '08-10(월)' */
export function shortWithWeekday(dateStr) {
  const w = weekdayOf(dateStr);
  const md = String(dateStr || "").slice(5);
  return w ? `${md}(${w})` : md;
}

/** Date/타임스탬프 → KST 기준 'YYYY-MM-DD' */
export function toKstDate(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

/**
 * 타임스탬프 → '2026. 8. 7. (금)'
 *
 * 기존 코드가 쓰던 toLocaleDateString() 은 브라우저 로케일에 따라 형식이 달라지고
 * 타임존도 방문자 기준이라, 해외에서 보면 날짜가 하루 어긋난다. KST 로 고정한다.
 */
export function kstDateLabel(value) {
  const iso = toKstDate(value);
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  return `${y}. ${Number(m)}. ${Number(d)}. (${weekdayOf(iso)})`;
}

/** 타임스탬프 → '8. 7.(금)' — 목록처럼 열이 좁은 곳 */
export function kstShortDateLabel(value) {
  const iso = toKstDate(value);
  if (!iso) return "";
  const [, m, d] = iso.split("-");
  return `${Number(m)}. ${Number(d)}.(${weekdayOf(iso)})`;
}

/** 타임스탬프 → '2026. 8. 7. (금) 오후 3:12' */
export function kstDateTimeLabel(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  const time = d.toLocaleTimeString("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "numeric",
    minute: "2-digit",
  });
  return `${kstDateLabel(d)} ${time}`;
}
