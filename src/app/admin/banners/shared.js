export const PLACEMENTS = [
  { id: "home_top", name: "홈 상단" },
  { id: "post_detail", name: "게시글 배너" },
];

export function placementLabel(id) {
  return PLACEMENTS.find((p) => p.id === id)?.name || id;
}

export function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
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
