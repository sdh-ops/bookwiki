"use client";

import { useEffect, useState, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { supabase } from "@/lib/supabase";
import { downloadCSV, placementLabel } from "./shared";

export default function StatsTab() {
  const [stats, setStats] = useState([]);
  const [daily, setDaily] = useState([]);
  const [statsDays, setStatsDays] = useState("30");
  const [selectedBannerId, setSelectedBannerId] = useState("");
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

  const loadDaily = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_banner_daily_stats", {
      p_banner_id: selectedBannerId || null,
      days_back: parseInt(statsDays),
    });
    if (error) {
      console.error("[StatsTab] daily error:", error.message);
      setDaily([]);
      return;
    }
    setDaily(
      (data || []).map((r) => ({
        date: r.kst_date?.slice(5) || "",
        노출: Number(r.impressions),
        클릭: Number(r.clicks),
      }))
    );
  }, [statsDays, selectedBannerId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 최초 마운트 및 기간 변경 시 데이터 로드
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 기간·캠페인 변경 시 추이 로드
    loadDaily();
  }, [loadDaily]);

  function exportCSV() {
    if (!stats.length) {
      alert("출력할 데이터가 없습니다.");
      return;
    }
    const headers = [
      "캠페인", "광고주", "위치",
      "노출수", "노출(PC)", "노출(모바일)",
      "클릭수", "클릭(PC)", "클릭(모바일)",
      "순클릭(세션)", "CTR(%)",
    ];
    const rows = stats.map((s) => [
      (s.banner_name || "").replace(/,/g, " "),
      (s.advertiser || "-").replace(/,/g, " "),
      placementLabel(s.placement),
      s.impressions, s.impressions_pc, s.impressions_mobile,
      s.clicks, s.clicks_pc, s.clicks_mobile,
      s.unique_click_sessions, s.ctr,
    ]);
    downloadCSV([headers, ...rows], `bookwiki_banner_stats_${statsDays}d.csv`);
  }

  const totals = stats.reduce(
    (a, s) => ({
      imp: a.imp + Number(s.impressions || 0),
      impPc: a.impPc + Number(s.impressions_pc || 0),
      impMo: a.impMo + Number(s.impressions_mobile || 0),
      clk: a.clk + Number(s.clicks || 0),
    }),
    { imp: 0, impPc: 0, impMo: 0, clk: 0 }
  );
  const deviceKnown = totals.impPc + totals.impMo;
  const mobileShare = deviceKnown > 0 ? Math.round((totals.impMo / deviceKnown) * 100) : null;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100">
          <div className="flex flex-wrap items-center gap-2">
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
            <select
              value={selectedBannerId}
              onChange={(e) => setSelectedBannerId(e.target.value)}
              className="border border-gray-300 rounded text-sm px-3 py-1.5 focus:outline-none focus:border-[#2c3e50] max-w-[260px]"
            >
              <option value="">추이: 전체 캠페인</option>
              {stats.map((s) => (
                <option key={s.banner_id} value={s.banner_id}>
                  추이: {s.banner_name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={exportCSV}
            className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 px-4 py-1.5 rounded text-sm font-bold"
          >
            ⬇️ 엑셀(CSV) 다운로드
          </button>
        </div>

        {/* 요약 */}
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-100 border-b border-gray-100">
          {[
            { label: "총 노출", value: totals.imp.toLocaleString(), tone: "text-gray-800" },
            { label: "총 클릭", value: totals.clk.toLocaleString(), tone: "text-emerald-700" },
            {
              label: "평균 CTR",
              value: totals.imp ? ((totals.clk / totals.imp) * 100).toFixed(2) + "%" : "-",
              tone: "text-purple-700",
            },
            {
              label: "모바일 비중",
              value: mobileShare === null ? "집계 전" : `${mobileShare}%`,
              tone: "text-blue-700",
            },
          ].map((c) => (
            <div key={c.label} className="p-4">
              <p className="text-[11px] text-gray-400 font-bold">{c.label}</p>
              <p className={`text-xl font-bold mt-1 ${c.tone}`}>{c.value}</p>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto min-h-[200px]">
          {statsLoading ? (
            <div className="flex justify-center items-center h-48 text-gray-400">불러오는 중...</div>
          ) : (
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3">캠페인</th>
                  <th className="px-5 py-3">광고주</th>
                  <th className="px-5 py-3">위치</th>
                  <th className="px-5 py-3 text-right">노출수</th>
                  <th className="px-5 py-3 text-right text-blue-700">PC / 모바일</th>
                  <th className="px-5 py-3 text-right">클릭수</th>
                  <th className="px-5 py-3 text-right text-blue-700">PC / 모바일</th>
                  <th className="px-5 py-3 text-right">순클릭</th>
                  <th className="px-5 py-3 text-right text-purple-700">CTR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stats.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="px-6 py-10 text-center text-gray-400">
                      데이터가 없습니다.
                    </td>
                  </tr>
                ) : (
                  stats.map((s) => (
                    <tr key={s.banner_id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-bold text-gray-800">
                        {s.banner_name}
                        {!s.is_active && <span className="ml-2 text-[10px] text-gray-400">(중지)</span>}
                      </td>
                      <td className="px-5 py-3 text-gray-500">{s.advertiser || "-"}</td>
                      <td className="px-5 py-3 text-gray-500">{placementLabel(s.placement)}</td>
                      <td className="px-5 py-3 text-right">{Number(s.impressions).toLocaleString()}</td>
                      <td className="px-5 py-3 text-right text-blue-700 text-xs">
                        {Number(s.impressions_pc).toLocaleString()} / {Number(s.impressions_mobile).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-emerald-700">
                        {Number(s.clicks).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right text-blue-700 text-xs">
                        {Number(s.clicks_pc).toLocaleString()} / {Number(s.clicks_mobile).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-500">
                        {Number(s.unique_click_sessions).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-purple-700">
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
          CTR = 클릭수 ÷ 노출수 × 100. 같은 방문자가 30분 안에 같은 배너를 여러 번 눌러도 클릭 1회로
          집계됩니다. 태블릿은 모바일에 합산됩니다. 기기 구분 도입(2026-08-07) 이전 로그는 PC/모바일
          어느 쪽에도 잡히지 않아 합이 총 노출수보다 작을 수 있습니다. 원천 로그는 6개월 보관.
        </p>
      </div>

      {/* 일별 추이 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
        <h3 className="font-bold text-gray-900 mb-4 text-sm">일별 노출 · 클릭 추이</h3>
        {daily.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-gray-400 text-sm">
            선택한 기간에 노출 기록이 없습니다.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={daily} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="노출" stroke="#2c3e50" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="클릭" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
