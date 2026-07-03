"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { downloadCSV } from "./shared";

export default function StatsTab() {
  const [stats, setStats] = useState([]);
  const [statsDays, setStatsDays] = useState("30");
  const [statsLoading, setStatsLoading] = useState(false);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    const { data, error } = await supabase.rpc("get_banner_stats", {
      days_back: parseInt(statsDays),
    });
    if (error) console.error("[StatsTab] error:", error.message);
    setStats(data || []);
    setStatsLoading(false);
  }, [statsDays]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 최초 마운트 및 기간 변경 시 데이터 로드
    loadStats();
  }, [loadStats]);

  function exportCSV() {
    if (!stats.length) {
      alert("출력할 데이터가 없습니다.");
      return;
    }
    const headers = ["캠페인", "광고주", "위치", "노출수", "클릭수", "순클릭(세션)", "CTR(%)"];
    const rows = stats.map((s) => [
      (s.banner_name || "").replace(/,/g, " "),
      (s.advertiser || "-").replace(/,/g, " "),
      s.placement,
      s.impressions,
      s.clicks,
      s.unique_click_sessions,
      s.ctr,
    ]);
    downloadCSV([headers, ...rows], `bookwiki_banner_stats_${statsDays}d.csv`);
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100">
        <select
          value={statsDays}
          onChange={(e) => setStatsDays(e.target.value)}
          className="border border-gray-300 rounded text-sm px-3 py-1.5 focus:outline-none focus:border-[#2c3e50]"
        >
          <option value="7">최근 7일</option>
          <option value="30">최근 30일</option>
          <option value="90">최근 90일</option>
          <option value="180">최근 180일</option>
        </select>
        <button
          onClick={exportCSV}
          className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 px-4 py-1.5 rounded text-sm font-bold"
        >
          ⬇️ 엑셀(CSV) 다운로드
        </button>
      </div>

      <div className="overflow-x-auto min-h-[300px]">
        {statsLoading ? (
          <div className="flex justify-center items-center h-64 text-gray-400">
            불러오는 중...
          </div>
        ) : (
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">캠페인</th>
                <th className="px-6 py-4">광고주</th>
                <th className="px-6 py-4 text-right">노출수</th>
                <th className="px-6 py-4 text-right">클릭수</th>
                <th className="px-6 py-4 text-right">순클릭(세션)</th>
                <th className="px-6 py-4 text-right text-purple-700">CTR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stats.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-10 text-center text-gray-400">
                    데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                stats.map((s) => (
                  <tr key={s.banner_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-bold text-gray-800">
                      {s.banner_name}
                      {!s.is_active && (
                        <span className="ml-2 text-[10px] text-gray-400">(중지)</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-500">{s.advertiser || "-"}</td>
                    <td className="px-6 py-4 text-right">
                      {Number(s.impressions).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-700">
                      {Number(s.clicks).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-500">
                      {Number(s.unique_click_sessions).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-purple-700">
                      {Number(s.ctr).toFixed(2)}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
      <p className="px-6 py-3 text-[11px] text-gray-400 border-t border-gray-100">
        CTR = 클릭수 ÷ 노출수 × 100. 원천 노출/클릭 로그는 6개월간 보관됩니다.
      </p>
    </div>
  );
}
