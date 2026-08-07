"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { PLACEMENTS, placementLabel } from "./shared";

const EMPTY_PLAN = {
  id: null,
  name: "",
  placements: [],
  duration_days: 30,
  prices: {}, // { placementId: 금액 } — 총액은 이 값들의 합
  is_active: true,
  sort_order: 0,
};

/**
 * 저장된 요금제를 폼의 위치별 단가 형태로 되돌린다.
 * placement_prices 가 없는 구 데이터는 총액을 위치 수로 균등 분배해서 채운다
 * (나머지는 첫 위치에 몰아 합계가 총액과 정확히 맞게).
 */
function toPriceMap(plan) {
  const places = plan.placements || [];
  if (plan.placement_prices) {
    return Object.fromEntries(places.map((p) => [p, plan.placement_prices[p] ?? 0]));
  }
  const n = places.length || 1;
  const base = Math.floor((plan.price_krw || 0) / n);
  const remainder = (plan.price_krw || 0) - base * n;
  return Object.fromEntries(places.map((p, i) => [p, base + (i === 0 ? remainder : 0)]));
}

function sumPrices(prices, placements) {
  return placements.reduce((s, p) => s + (parseInt(prices[p]) || 0), 0);
}

export default function PlansTab() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(EMPTY_PLAN);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("bw_banner_plans")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) console.error("[PlansTab] load error:", error.message);
    setPlans(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 최초 마운트 시 요금제 목록 로드
    load();
  }, [load]);

  function resetForm() {
    setForm(EMPTY_PLAN);
  }

  function editPlan(p) {
    setForm({
      id: p.id,
      name: p.name,
      placements: p.placements || [],
      duration_days: p.duration_days,
      prices: toPriceMap(p),
      is_active: p.is_active,
      sort_order: p.sort_order || 0,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function togglePlacement(id) {
    setForm((f) => {
      const on = f.placements.includes(id);
      const placements = on ? f.placements.filter((x) => x !== id) : [...f.placements, id];
      const prices = { ...f.prices };
      if (on) delete prices[id];
      else if (prices[id] === undefined) prices[id] = "";
      return { ...f, placements, prices };
    });
  }

  function setPrice(id, value) {
    setForm((f) => ({ ...f, prices: { ...f.prices, [id]: value } }));
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim() || form.placements.length === 0) {
      alert("요금제 이름과 노출 위치는 필수입니다.");
      return;
    }
    const missing = form.placements.filter((p) => !(parseInt(form.prices[p]) > 0));
    if (missing.length) {
      alert(`${missing.map(placementLabel).join(", ")} 의 금액을 입력해주세요.`);
      return;
    }

    setSaving(true);
    const placementPrices = Object.fromEntries(
      form.placements.map((p) => [p, parseInt(form.prices[p]) || 0])
    );
    const payload = {
      name: form.name.trim(),
      placements: form.placements,
      duration_days: parseInt(form.duration_days) || 30,
      // price_krw 는 계속 "총액". 목록·가이드·매출 집계가 이 값을 본다.
      price_krw: sumPrices(form.prices, form.placements),
      placement_prices: placementPrices,
      is_active: form.is_active,
      sort_order: parseInt(form.sort_order) || 0,
      updated_at: new Date().toISOString(),
    };
    let error;
    if (form.id) {
      ({ error } = await supabase.from("bw_banner_plans").update(payload).eq("id", form.id));
    } else {
      ({ error } = await supabase.from("bw_banner_plans").insert(payload));
    }
    setSaving(false);
    if (error) {
      alert("저장 실패: " + error.message);
      return;
    }
    resetForm();
    load();
  }

  async function toggleActive(p) {
    const { error } = await supabase
      .from("bw_banner_plans")
      .update({ is_active: !p.is_active, updated_at: new Date().toISOString() })
      .eq("id", p.id);
    if (error) {
      alert("변경 실패: " + error.message);
      return;
    }
    load();
  }

  async function deletePlan(p) {
    if (!confirm(`'${p.name}' 요금제를 삭제할까요? (이미 등록된 배너에는 영향을 주지 않습니다)`))
      return;
    const { error } = await supabase.from("bw_banner_plans").delete().eq("id", p.id);
    if (error) {
      alert("삭제 실패: " + error.message);
      return;
    }
    load();
  }

  return (
    <div className="space-y-8">
      <form
        onSubmit={handleSave}
        className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4"
      >
        <h3 className="text-lg font-bold text-gray-900">
          {form.id ? "요금제 수정" : "새 요금제 등록"}
        </h3>

        <label className="block">
          <span className="text-sm font-bold text-gray-600">요금제 이름 *</span>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="예: 상단배너 1개월"
            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#2c3e50]"
          />
        </label>

        <div>
          <span className="text-sm font-bold text-gray-600">
            노출 위치 · 위치별 단가 * <span className="font-normal text-gray-400">(복수 선택 시 패키지 요금제)</span>
          </span>
          <div className="mt-2 space-y-2">
            {PLACEMENTS.map((p) => {
              const on = form.placements.includes(p.id);
              return (
                <div
                  key={p.id}
                  className={`flex flex-wrap items-center gap-3 rounded border px-3 py-2 transition ${
                    on ? "border-[#2c3e50] bg-gray-50" : "border-gray-200"
                  }`}
                >
                  <label className="flex items-center gap-2 text-sm min-w-[180px] cursor-pointer">
                    <input type="checkbox" checked={on} onChange={() => togglePlacement(p.id)} />
                    <span className={on ? "font-bold text-gray-800" : "text-gray-500"}>{p.name}</span>
                  </label>
                  {on && (
                    <label className="flex items-center gap-2 text-xs text-gray-500">
                      단가
                      <input
                        type="number"
                        min="0"
                        value={form.prices[p.id] ?? ""}
                        onChange={(e) => setPrice(p.id, e.target.value)}
                        placeholder="예: 400000"
                        className="w-36 px-3 py-1.5 border border-gray-300 rounded text-sm text-right focus:outline-none focus:border-[#2c3e50]"
                      />
                      원
                    </label>
                  )}
                </div>
              );
            })}
          </div>
          {form.placements.length > 0 && (
            <p className="mt-2 text-xs text-gray-600">
              총 계약 금액{" "}
              <strong className="text-gray-900">
                {sumPrices(form.prices, form.placements).toLocaleString()}원
              </strong>{" "}
              (VAT 별도)
              {form.placements.length > 1 && (
                <span className="text-gray-400">
                  {" "}
                  — 저장 시 배너가 위치별로 나뉘어 등록되고, 각 위치에 위 단가가 그대로 기록됩니다
                </span>
              )}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-bold text-gray-600">게재 기간 (일)</span>
            <input
              type="number"
              value={form.duration_days}
              onChange={(e) => setForm({ ...form, duration_days: e.target.value })}
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
          <span className="text-sm font-bold text-gray-600">등록 화면에 노출(활성)</span>
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
              onClick={resetForm}
              className="px-6 py-2 bg-gray-100 text-gray-600 rounded font-bold text-sm hover:bg-gray-200"
            >
              취소
            </button>
          )}
        </div>
      </form>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 font-bold text-gray-900">
          등록된 요금제 ({plans.length})
        </div>
        {loading ? (
          <div className="p-10 text-center text-gray-400 text-sm">불러오는 중...</div>
        ) : plans.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">등록된 요금제가 없습니다.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {plans.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-4 p-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900 text-sm">{p.name}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        p.is_active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {p.is_active ? "노출중" : "숨김"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {p.duration_days}일 · 총 {Number(p.price_krw).toLocaleString()}원 (VAT 별도)
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {p.placements
                      .map((id) => `${placementLabel(id)} ${Number(toPriceMap(p)[id] || 0).toLocaleString()}원`)
                      .join(" + ")}
                    {!p.placement_prices && p.placements.length > 1 && (
                      <span className="text-amber-600"> · 균등 분배(위치별 단가 미설정)</span>
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleActive(p)}
                    className="px-3 py-1.5 text-xs font-bold rounded bg-gray-100 text-gray-600 hover:bg-gray-200"
                  >
                    {p.is_active ? "숨기기" : "노출"}
                  </button>
                  <button
                    onClick={() => editPlan(p)}
                    className="px-3 py-1.5 text-xs font-bold rounded bg-blue-50 text-blue-600 hover:bg-blue-100"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => deletePlan(p)}
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
  );
}
