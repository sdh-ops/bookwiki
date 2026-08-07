// 게재 위치·규격 정본은 src/lib/bannerPlacements.js 하나로 두고 여기서는 재수출만 한다.
// (공개 사이트의 Banner 컴포넌트와 관리 화면이 같은 정의를 봐야 규격 안내가 어긋나지 않는다)
export {
  PLACEMENTS,
  ROTATION_MODES,
  CREATIVE_SPEC_TEXT,
  getPlacement,
  placementLabel,
} from "@/lib/bannerPlacements";

/** YYYY-MM-DD (KST). new Date().toISOString() 은 UTC 라 00~09시에 하루 밀린다. */
export function todayKST() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

export function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

/**
 * 패키지 요금제를 위치별 금액으로 쪼갠다.
 *
 * 요금제에 위치별 단가(placement_prices)가 정해져 있고 관리자가 총액을 손대지 않았다면
 * 그 값을 그대로 쓴다. 총액을 조정했다면(할인 협의 등) 균등 분배로 떨어뜨리되,
 * 나머지를 첫 위치에 몰아 합계가 입력한 총액과 정확히 일치하게 한다.
 */
export function splitPlanPrice(plan, enteredTotal) {
  const places = plan.placements || [];
  const total =
    enteredTotal === "" || enteredTotal === null || enteredTotal === undefined
      ? plan.price_krw
      : parseInt(enteredTotal) || 0;

  if (plan.placement_prices && total === plan.price_krw) {
    return Object.fromEntries(places.map((p) => [p, plan.placement_prices[p] ?? 0]));
  }

  const n = places.length || 1;
  const base = Math.floor(total / n);
  const remainder = total - base * n;
  return Object.fromEntries(places.map((p, i) => [p, base + (i === 0 ? remainder : 0)]));
}

export function downloadCSV(rows, filename) {
  const csvContent =
    "data:text/csv;charset=utf-8,﻿" + rows.map((e) => e.join(",")).join("\n");
  const link = document.createElement("a");
  link.setAttribute("href", encodeURI(csvContent));
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
