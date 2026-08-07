"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { todayKST } from "./shared";

const BOARDS = [
  { id: "free", name: "톡톡" },
  { id: "job", name: "구인구직" },
  { id: "support", name: "지원사업" },
];

const EMPTY = {
  id: null,
  board_type: "free",
  label: "",
  sort_order: 0,
  sponsor_advertiser: "",
  is_active: true,
};

export default function CategoriesTab() {
  const [rows, setRows] = useState([]);
  const [liveAdvertisers, setLiveAdvertisers] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const today = todayKST();

    const [cats, banners] = await Promise.all([
      supabase
        .from("bw_post_categories")
        .select("*")
        .order("board_type", { ascending: true })
        .order("sort_order", { ascending: true }),
      supabase
        .from("bw_banners")
        .select("advertiser, is_active, is_deleted, start_date, end_date")
        .eq("is_active", true)
        .eq("is_deleted", false),
    ]);

    if (cats.error) console.error("[CategoriesTab] load error:", cats.error.message);
    setRows(cats.data || []);

    // 지금 실제로 게재중인 광고주 목록 — 스폰서 말머리가 노출되는지 표시용
    const live = (banners.data || [])
      .filter(
        (b) =>
          b.advertiser &&
          (!b.start_date || b.start_date <= today) &&
          (!b.end_date || b.end_date >= today)
      )
      .map((b) => b.advertiser);
    setLiveAdvertisers([...new Set(live)]);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 최초 마운트 시 말머리 로드
    load();
  }, [load]);

  function editRow(r) {
    setForm({
      id: r.id,
      board_type: r.board_type,
      label: r.label,
      sort_order: r.sort_order || 0,
      sponsor_advertiser: r.sponsor_advertiser || "",
      is_active: r.is_active,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSave(e) {
    e.preventDefault();
    const label = form.label.trim();
    if (!label) {
      alert("말머리 이름은 필수입니다.");
      return;
    }
    if (label.includes("[") || label.includes("]")) {
      alert("대괄호는 자동으로 붙습니다. 이름만 입력해주세요. (예: 한겨레교육)");
      return;
    }

    setSaving(true);
    const payload = {
      board_type: form.board_type,
      label,
      sort_order: parseInt(form.sort_order) || 0,
      sponsor_advertiser: form.sponsor_advertiser.trim() || null,
      is_active: form.is_active,
      updated_at: new Date().toISOString(),
    };

    const { error } = form.id
      ? await supabase.from("bw_post_categories").update(payload).eq("id", form.id)
      : await supabase.from("bw_post_categories").insert(payload);

    setSaving(false);
    if (error) {
      alert("저장 실패: " + error.message);
      return;
    }
    setForm(EMPTY);
    load();
  }

  async function toggleActive(r) {
    const { error } = await supabase
      .from("bw_post_categories")
      .update({ is_active: !r.is_active, updated_at: new Date().toISOString() })
      .eq("id", r.id);
    if (error) {
      alert("변경 실패: " + error.message);
      return;
    }
    load();
  }

  async function remove(r) {
    if (
      !confirm(
        `'[${r.label}]' 말머리를 삭제할까요?\n이미 이 말머리로 작성된 글의 제목은 그대로 남습니다.`
      )
    )
      return;
    const { error } = await supabase.from("bw_post_categories").delete().eq("id", r.id);
    if (error) {
      alert("삭제 실패: " + error.message);
      return;
    }
    load();
  }

  function visibilityOf(r) {
    if (!r.is_active) return { text: "숨김", tone: "bg-gray-100 text-gray-400" };
    if (!r.sponsor_advertiser) return { text: "상시 노출", tone: "bg-emerald-100 text-emerald-700" };
    return liveAdvertisers.includes(r.sponsor_advertiser)
      ? { text: "광고 게재중 → 노출", tone: "bg-amber-100 text-amber-700" }
      : { text: "광고 없음 → 숨김", tone: "bg-gray-100 text-gray-500" };
  }

  return (
    <div className="space-y-8">
      <form
        onSubmit={handleSave}
        className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4"
      >
        <h3 className="text-lg font-bold text-gray-900">
          {form.id ? "말머리 수정" : "새 말머리 등록"}
        </h3>
        <p className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded px-3 py-2">
          말머리는 글 제목 앞에 <strong>[이름]</strong> 형태로 붙습니다. <strong>스폰서 광고주</strong>를
          입력하면 그 광고주의 배너가 게재중일 때만 말머리가 나타나고, 광고가 끝나면 자동으로
          사라집니다. (이미 작성된 글의 제목은 그대로 유지됩니다)
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <label className="block">
            <span className="text-sm font-bold text-gray-600">게시판</span>
            <select
              value={form.board_type}
              onChange={(e) => setForm({ ...form, board_type: e.target.value })}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#2c3e50]"
            >
              {BOARDS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-bold text-gray-600">말머리 이름 *</span>
            <input
              type="text"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="예: 한겨레교육"
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#2c3e50]"
            />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-gray-600">스폰서 광고주 (선택)</span>
            <input
              type="text"
              value={form.sponsor_advertiser}
              onChange={(e) => setForm({ ...form, sponsor_advertiser: e.target.value })}
              placeholder="예: 한겨레교육"
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#2c3e50]"
            />
            <span className="block mt-1 text-[11px] text-gray-400">
              배너의 「광고주명」과 <strong>정확히 같아야</strong> 연결됩니다
            </span>
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
          <span className="text-sm font-bold text-gray-600">사용(활성)</span>
        </label>

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-[#2c3e50] text-white rounded font-bold text-sm hover:bg-[#34495e] disabled:opacity-50"
          >
            {saving ? "저장 중..." : form.id ? "수정 저장" : "등록"}
          </button>
          {form.id && (
            <button
              type="button"
              onClick={() => setForm(EMPTY)}
              className="px-6 py-2 bg-gray-100 text-gray-600 rounded font-bold text-sm hover:bg-gray-200"
            >
              취소
            </button>
          )}
        </div>
      </form>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 font-bold text-gray-900">
          등록된 말머리 ({rows.length})
        </div>
        {loading ? (
          <div className="p-10 text-center text-gray-400 text-sm">불러오는 중...</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">등록된 말머리가 없습니다.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {rows.map((r) => {
              const v = visibilityOf(r);
              return (
                <div key={r.id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="flex-1 min-w-[220px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900 text-sm">[{r.label}]</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-gray-100 text-gray-500">
                        {BOARDS.find((b) => b.id === r.board_type)?.name || r.board_type}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${v.tone}`}>
                        {v.text}
                      </span>
                    </div>
                    {r.sponsor_advertiser && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        스폰서: {r.sponsor_advertiser}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleActive(r)}
                      className="px-3 py-1.5 text-xs font-bold rounded bg-gray-100 text-gray-600 hover:bg-gray-200"
                    >
                      {r.is_active ? "숨기기" : "사용"}
                    </button>
                    <button
                      onClick={() => editRow(r)}
                      className="px-3 py-1.5 text-xs font-bold rounded bg-blue-50 text-blue-600 hover:bg-blue-100"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => remove(r)}
                      className="px-3 py-1.5 text-xs font-bold rounded bg-red-50 text-red-600 hover:bg-red-100"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="px-6 py-3 text-[11px] text-gray-400 border-t border-gray-100">
          현재 게재중 광고주: {liveAdvertisers.length ? liveAdvertisers.join(", ") : "없음"}
        </p>
      </div>
    </div>
  );
}
