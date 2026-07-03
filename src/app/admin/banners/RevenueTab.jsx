"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { placementLabel, downloadCSV } from "./shared";

const STATUS_OPTIONS = ["미입금", "입금완료", "취소"];

function monthKey(dateStr) {
  return dateStr ? dateStr.slice(0, 7) : "미지정";
}

export default function RevenueTab() {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(false);

  // 삭제(숨김)된 배너도 매출/입금 기록 보존을 위해 필터 없이 전부 불러온다.
  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("bw_banners")
      .select(
        "id, name, advertiser, placement, price_krw, payment_status, start_date, end_date, memo, is_deleted"
      )
      .order("start_date", { ascending: false });
    if (error) console.error("[RevenueTab] load error:", error.message);
    setBanners(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 최초 마운트 시 계약 목록 로드
    load();
  }, [load]);

  async function updateStatus(b, status) {
    const { error } = await supabase
      .from("bw_banners")
      .update({ payment_status: status, updated_at: new Date().toISOString() })
      .eq("id", b.id);
    if (error) {
      alert("변경 실패: " + error.message);
      return;
    }
    load();
  }

  // "총 계약 금액"은 취소 건을 제외한 유효 계약(미입금+입금완료) 합계로 집계한다.
  // 취소 금액은 별도 카드로 보여주므로, 총액에 취소분이 섞여 과대 계상되지 않도록 한다.
  const summary = useMemo(() => {
    return banners.reduce(
      (acc, b) => {
        const amount = b.price_krw || 0;
        if (b.payment_status === "입금완료") acc.paid += amount;
        else if (b.payment_status === "취소") acc.canceled += amount;
        else acc.unpaid += amount;
        if (b.payment_status !== "취소") acc.total += amount;
        return acc;
      },
      { total: 0, paid: 0, unpaid: 0, canceled: 0 }
    );
  }, [banners]);

  const monthlyRows = useMemo(() => {
    const groups = {};
    banners.forEach((b) => {
      const key = monthKey(b.start_date);
      if (!groups[key]) {
        groups[key] = { month: key, count: 0, total: 0, paid: 0, unpaid: 0, canceled: 0 };
      }
      const amount = b.price_krw || 0;
      groups[key].count += 1;
      if (b.payment_status === "입금완료") groups[key].paid += amount;
      else if (b.payment_status === "취소") groups[key].canceled += amount;
      else groups[key].unpaid += amount;
      if (b.payment_status !== "취소") groups[key].total += amount;
    });
    return Object.values(groups).sort((a, b) => b.month.localeCompare(a.month));
  }, [banners]);

  function exportCSV() {
    if (!banners.length) {
      alert("출력할 데이터가 없습니다.");
      return;
    }
    const headers = ["캠페인", "광고주", "위치", "게재시작", "게재종료", "계약금액", "입금상태", "메모"];
    const rows = banners.map((b) => [
      (b.name || "").replace(/,/g, " "),
      (b.advertiser || "-").replace(/,/g, " "),
      placementLabel(b.placement),
      b.start_date || "-",
      b.end_date || "-",
      b.price_krw || 0,
      b.payment_status,
      (b.memo || "").replace(/,/g, " "),
    ]);
    downloadCSV([headers, ...rows], "bookwiki_banner_revenue.csv");
  }

  return (
    <div className="space-y-6">
      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "총 계약 금액 (취소 제외)", value: summary.total, color: "text-gray-900" },
          { label: "입금 완료", value: summary.paid, color: "text-emerald-600" },
          { label: "미입금", value: summary.unpaid, color: "text-amber-600" },
          { label: "취소", value: summary.canceled, color: "text-red-500" },
        ].map((s) => (
          <div key={s.label} className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
            <p className="text-sm font-bold text-gray-500 mb-1">{s.label}</p>
            <p className={`text-xl font-black ${s.color}`}>{s.value.toLocaleString()}원</p>
          </div>
        ))}
      </div>

      {/* 월별 계약 현황 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 font-bold text-gray-900">
          월별 계약 현황
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200">
              <tr>
                <th className="px-6 py-3">게재 시작월</th>
                <th className="px-6 py-3 text-right">계약 건수</th>
                <th className="px-6 py-3 text-right">유효 계약 금액</th>
                <th className="px-6 py-3 text-right text-emerald-700">입금 완료</th>
                <th className="px-6 py-3 text-right text-amber-700">미입금</th>
                <th className="px-6 py-3 text-right text-red-500">취소</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {monthlyRows.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-10 text-center text-gray-400">
                    데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                monthlyRows.map((r) => (
                  <tr key={r.month} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-bold text-gray-700">{r.month}</td>
                    <td className="px-6 py-3 text-right">{r.count}</td>
                    <td className="px-6 py-3 text-right font-bold">{r.total.toLocaleString()}원</td>
                    <td className="px-6 py-3 text-right text-emerald-700">
                      {r.paid.toLocaleString()}원
                    </td>
                    <td className="px-6 py-3 text-right text-amber-700">
                      {r.unpaid.toLocaleString()}원
                    </td>
                    <td className="px-6 py-3 text-right text-red-500">
                      {r.canceled.toLocaleString()}원
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 계약별 입금 관리 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100">
          <span className="font-bold text-gray-900">계약별 입금 관리</span>
          <button
            onClick={exportCSV}
            className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 px-4 py-1.5 rounded text-sm font-bold"
          >
            ⬇️ 엑셀(CSV) 다운로드
          </button>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-10 text-center text-gray-400 text-sm">불러오는 중...</div>
          ) : (
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3">캠페인</th>
                  <th className="px-6 py-3">광고주</th>
                  <th className="px-6 py-3">위치</th>
                  <th className="px-6 py-3">게재기간</th>
                  <th className="px-6 py-3 text-right">계약금액</th>
                  <th className="px-6 py-3">입금상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {banners.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-10 text-center text-gray-400">
                      등록된 배너가 없습니다.
                    </td>
                  </tr>
                ) : (
                  banners.map((b) => (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 font-bold text-gray-800">
                        {b.name}
                        {b.is_deleted && (
                          <span className="ml-2 text-[10px] font-bold text-gray-400">
                            (삭제됨)
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-gray-500">{b.advertiser || "-"}</td>
                      <td className="px-6 py-3 text-gray-500">{placementLabel(b.placement)}</td>
                      <td className="px-6 py-3 text-gray-500">
                        {b.start_date || "~"} ~ {b.end_date || "~"}
                      </td>
                      <td className="px-6 py-3 text-right font-bold">
                        {(b.price_krw || 0).toLocaleString()}원
                      </td>
                      <td className="px-6 py-3">
                        <select
                          value={b.payment_status}
                          onChange={(e) => updateStatus(b, e.target.value)}
                          className={`text-xs font-bold rounded px-2 py-1 border ${
                            b.payment_status === "입금완료"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : b.payment_status === "취소"
                              ? "bg-red-50 text-red-600 border-red-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
        <p className="px-6 py-3 text-[11px] text-gray-400 border-t border-gray-100">
          모든 금액은 VAT 별도 계약 기준입니다. 게재 시작월 기준으로 집계되며, 「유효 계약 금액」과
          「총 계약 금액」은 취소 건을 제외한 금액입니다. 소재 관리에서 삭제한 배너도 매출 기록
          보존을 위해 이 목록에 계속 표시됩니다.
        </p>
      </div>
    </div>
  );
}
