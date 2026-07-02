"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { uploadImage } from "@/lib/upload";

const PLACEMENTS = [
  { id: "home_top", name: "홈 상단" },
];

const EMPTY_FORM = {
  id: null,
  name: "",
  advertiser: "",
  image_url: "",
  link_url: "",
  placement: "home_top",
  is_active: true,
  start_date: "",
  end_date: "",
  sort_order: 0,
};

function downloadCSV(rows, filename) {
  const csvContent =
    "data:text/csv;charset=utf-8,﻿" + rows.map((e) => e.join(",")).join("\n");
  const link = document.createElement("a");
  link.setAttribute("href", encodeURI(csvContent));
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function AdminBannersPage() {
  const [tab, setTab] = useState("manage"); // manage | stats
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 성과 리포트
  const [stats, setStats] = useState([]);
  const [statsDays, setStatsDays] = useState("30");
  const [statsLoading, setStatsLoading] = useState(false);

  const loadBanners = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("bw_banners")
      .select("*")
      .order("placement", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) console.error("[Banners] load error:", error.message);
    setBanners(data || []);
    setLoading(false);
  }, []);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    const { data, error } = await supabase.rpc("get_banner_stats", {
      days_back: parseInt(statsDays),
    });
    if (error) console.error("[Banners] stats error:", error.message);
    setStats(data || []);
    setStatsLoading(false);
  }, [statsDays]);

  useEffect(() => {
    loadBanners();
  }, [loadBanners]);

  useEffect(() => {
    if (tab === "stats") loadStats();
  }, [tab, loadStats]);

  function resetForm() {
    setForm(EMPTY_FORM);
  }

  function editBanner(b) {
    setForm({
      id: b.id,
      name: b.name || "",
      advertiser: b.advertiser || "",
      image_url: b.image_url || "",
      link_url: b.link_url || "",
      placement: b.placement || "home_top",
      is_active: b.is_active,
      start_date: b.start_date || "",
      end_date: b.end_date || "",
      sort_order: b.sort_order || 0,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await uploadImage(file);
      setForm((f) => ({ ...f, image_url: url }));
    } catch (err) {
      alert(err.message || "이미지 업로드 실패");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.image_url.trim() || !form.link_url.trim()) {
      alert("캠페인 이름, 배너 이미지, 링크 URL은 필수입니다.");
      return;
    }
    setSaving(true);

    const payload = {
      name: form.name.trim(),
      advertiser: form.advertiser.trim() || null,
      image_url: form.image_url.trim(),
      link_url: form.link_url.trim(),
      placement: form.placement,
      is_active: form.is_active,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      sort_order: parseInt(form.sort_order) || 0,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (form.id) {
      ({ error } = await supabase.from("bw_banners").update(payload).eq("id", form.id));
    } else {
      ({ error } = await supabase.from("bw_banners").insert(payload));
    }

    setSaving(false);
    if (error) {
      alert("저장 실패: " + error.message);
      return;
    }
    resetForm();
    loadBanners();
  }

  async function toggleActive(b) {
    const { error } = await supabase
      .from("bw_banners")
      .update({ is_active: !b.is_active, updated_at: new Date().toISOString() })
      .eq("id", b.id);
    if (error) {
      alert("변경 실패: " + error.message);
      return;
    }
    loadBanners();
  }

  async function deleteBanner(b) {
    if (!confirm(`'${b.name}' 배너를 삭제할까요? (관련 노출/클릭 기록도 함께 삭제됩니다)`)) return;
    const { error } = await supabase.from("bw_banners").delete().eq("id", b.id);
    if (error) {
      alert("삭제 실패: " + error.message);
      return;
    }
    loadBanners();
  }

  function exportStatsCSV() {
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
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">배너 광고 관리</h2>

      {/* 탭 */}
      <div className="flex gap-2 mb-6">
        {[
          { id: "manage", label: "소재 관리" },
          { id: "stats", label: "광고 성과 (리포트)" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-2 rounded-lg text-sm font-bold transition ${
              tab === t.id
                ? "bg-[#2c3e50] text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "manage" ? (
        <div className="space-y-8">
          {/* 소재 등록/수정 폼 */}
          <form
            onSubmit={handleSave}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4"
          >
            <h3 className="text-lg font-bold text-gray-900">
              {form.id ? "배너 수정" : "새 배너 등록"}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-sm font-bold text-gray-600">캠페인 이름 *</span>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="예: 2026 신간 프로모션"
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#2c3e50]"
                />
              </label>
              <label className="block">
                <span className="text-sm font-bold text-gray-600">광고주명</span>
                <input
                  type="text"
                  value={form.advertiser}
                  onChange={(e) => setForm({ ...form, advertiser: e.target.value })}
                  placeholder="예: 위즈덤하우스"
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#2c3e50]"
                />
              </label>
            </div>

            {/* 이미지 */}
            <div>
              <span className="text-sm font-bold text-gray-600">배너 이미지 *</span>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="text-sm"
                />
                {uploading && <span className="text-xs text-gray-400">업로드 중...</span>}
              </div>
              <input
                type="text"
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                placeholder="또는 이미지 URL 직접 입력"
                className="mt-2 w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-[#2c3e50]"
              />
              {form.image_url && (
                <div className="mt-3 w-full max-w-2xl bg-gray-100 rounded overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.image_url}
                    alt="미리보기"
                    className="w-full h-20 md:h-24 object-cover"
                  />
                </div>
              )}
            </div>

            <label className="block">
              <span className="text-sm font-bold text-gray-600">클릭 링크 URL *</span>
              <input
                type="url"
                value={form.link_url}
                onChange={(e) => setForm({ ...form, link_url: e.target.value })}
                placeholder="https://..."
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#2c3e50]"
              />
            </label>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <label className="block">
                <span className="text-sm font-bold text-gray-600">노출 위치</span>
                <select
                  value={form.placement}
                  onChange={(e) => setForm({ ...form, placement: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#2c3e50]"
                >
                  {PLACEMENTS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-bold text-gray-600">게재 시작</span>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#2c3e50]"
                />
              </label>
              <label className="block">
                <span className="text-sm font-bold text-gray-600">게재 종료</span>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#2c3e50]"
                />
              </label>
              <label className="block">
                <span className="text-sm font-bold text-gray-600">정렬 순서</span>
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#2c3e50]"
                />
              </label>
            </div>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              <span className="text-sm font-bold text-gray-600">게재중(활성)</span>
            </label>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={saving || uploading}
                className="px-6 py-2 bg-[#2c3e50] text-white rounded font-bold text-sm hover:bg-[#34495e] disabled:opacity-50"
              >
                {saving ? "저장 중..." : form.id ? "수정 저장" : "등록"}
              </button>
              {form.id && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-2 bg-gray-100 text-gray-600 rounded font-bold text-sm hover:bg-gray-200"
                >
                  취소
                </button>
              )}
            </div>
          </form>

          {/* 소재 목록 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 font-bold text-gray-900">
              등록된 배너 ({banners.length})
            </div>
            {loading ? (
              <div className="p-10 text-center text-gray-400 text-sm">불러오는 중...</div>
            ) : banners.length === 0 ? (
              <div className="p-10 text-center text-gray-400 text-sm">
                등록된 배너가 없습니다. 위에서 새 배너를 등록하세요.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {banners.map((b) => (
                  <div key={b.id} className="flex flex-wrap items-center gap-4 p-4">
                    <div className="w-40 h-14 bg-gray-100 rounded overflow-hidden shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={b.image_url} alt={b.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-[180px]">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 text-sm">{b.name}</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            b.is_active
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-gray-100 text-gray-400"
                          }`}
                        >
                          {b.is_active ? "게재중" : "중지"}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {b.advertiser || "광고주 미지정"} · {b.placement}
                        {(b.start_date || b.end_date) &&
                          ` · ${b.start_date || "~"} ~ ${b.end_date || "~"}`}
                      </p>
                      <a
                        href={b.link_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:underline break-all"
                      >
                        {b.link_url}
                      </a>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleActive(b)}
                        className="px-3 py-1.5 text-xs font-bold rounded bg-gray-100 text-gray-600 hover:bg-gray-200"
                      >
                        {b.is_active ? "중지" : "게재"}
                      </button>
                      <button
                        onClick={() => editBanner(b)}
                        className="px-3 py-1.5 text-xs font-bold rounded bg-blue-50 text-blue-600 hover:bg-blue-100"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => deleteBanner(b)}
                        className="px-3 py-1.5 text-xs font-bold rounded bg-red-50 text-red-600 hover:bg-red-100"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        // ── 광고 성과 리포트 ──
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
              onClick={exportStatsCSV}
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
      )}
    </div>
  );
}
