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
