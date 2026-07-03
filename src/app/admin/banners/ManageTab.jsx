"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { uploadImage } from "@/lib/upload";
import { PLACEMENTS, placementLabel, addDays } from "./shared";

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
  price_krw: "",
  plan_id: "",
  payment_status: "미입금",
  memo: "",
};

export default function ManageTab() {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedPlanId, setSelectedPlanId] = useState("custom");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadBanners = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("bw_banners")
      .select("*")
      .eq("is_deleted", false)
      .order("placement", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) console.error("[ManageTab] load error:", error.message);
    setBanners(data || []);
    setLoading(false);
  }, []);

  const loadPlans = useCallback(async () => {
    const { data, error } = await supabase
      .from("bw_banner_plans")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (error) console.error("[ManageTab] plans load error:", error.message);
    setPlans(data || []);
  }, []);

  useEffect(() => {
    loadBanners();
    loadPlans();
  }, [loadBanners, loadPlans]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setSelectedPlanId("custom");
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
      price_krw: b.price_krw ?? "",
      plan_id: b.plan_id || "",
      payment_status: b.payment_status || "미입금",
      memo: b.memo || "",
    });
    // 수정 화면에서는 요금제 프리셋을 다시 적용하지 않고 항상 수동 입력으로 다룬다.
    // (패키지 요금제는 위치별로 row 가 나뉘어 있어 한쪽만 편집해도 다른 쪽엔 영향 없음)
    setSelectedPlanId("custom");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // 요금제 프리셋 선택 시 위치/기간/금액 자동 채움 (신규 등록 시에만 사용)
  function handlePlanChange(planId) {
    setSelectedPlanId(planId);
    const plan = plans.find((p) => p.id === planId);
    if (!plan) {
      // "직접 설정"으로 되돌리면 이전에 선택했던 요금제의 금액이 남아있지 않도록 초기화
      setForm((f) => ({ ...f, price_krw: "", plan_id: "" }));
      return;
    }

    const start = form.start_date || new Date().toISOString().split("T")[0];
    const end = addDays(start, plan.duration_days);
    setForm((f) => ({
      ...f,
      placement: plan.placements[0],
      start_date: start,
      end_date: end,
      price_krw: plan.price_krw,
      plan_id: plan.id,
    }));
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

    const basePayload = {
      name: form.name.trim(),
      advertiser: form.advertiser.trim() || null,
      image_url: form.image_url.trim(),
      link_url: form.link_url.trim(),
      is_active: form.is_active,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      sort_order: parseInt(form.sort_order) || 0,
      payment_status: form.payment_status,
      memo: form.memo.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const plan = plans.find((p) => p.id === selectedPlanId);
    const isNewBundle = !form.id && plan && plan.placements.length > 1;

    let error;
    if (form.id) {
      // 수정: 항상 단일 row (패키지도 위치별로 개별 row 이므로 각자 편집)
      const payload = {
        ...basePayload,
        placement: form.placement,
        price_krw: form.price_krw === "" ? null : parseInt(form.price_krw),
        plan_id: form.plan_id || null,
      };
      ({ error } = await supabase.from("bw_banners").update(payload).eq("id", form.id));
    } else if (isNewBundle) {
      // 신규 + 패키지 요금제: 위치별로 row 를 나눠 생성.
      // 관리자가 요금제 선택 후 계약 금액을 수동으로 조정(할인 협의 등)했을 수 있으므로
      // 항상 form.price_krw(현재 입력값)를 분배 기준으로 쓴다 (plan.price_krw 는 미조정 시 폴백).
      // 금액은 내림으로 균등 분배하고 나머지(원 단위 반올림 오차)는 첫 위치에 몰아,
      // row 들의 합계가 실제 계약 금액과 정확히 일치하도록 한다 (매출 합계 오차 방지).
      const totalPrice = form.price_krw === "" ? plan.price_krw : parseInt(form.price_krw);
      const n = plan.placements.length;
      const basePrice = Math.floor(totalPrice / n);
      const remainder = totalPrice - basePrice * n;
      const rows = plan.placements.map((placement, idx) => ({
        ...basePayload,
        placement,
        price_krw: basePrice + (idx === 0 ? remainder : 0),
        plan_id: plan.id,
      }));
      ({ error } = await supabase.from("bw_banners").insert(rows));
    } else {
      const payload = {
        ...basePayload,
        placement: form.placement,
        price_krw: form.price_krw === "" ? null : parseInt(form.price_krw),
        plan_id: form.plan_id || null,
      };
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
    if (
      !confirm(
        `'${b.name}' 배너를 삭제할까요? 소재 관리 목록에서만 숨겨지고, 매출/성과 기록은 "매출 관리" 탭에 그대로 보존됩니다.`
      )
    )
      return;
    const { error } = await supabase
      .from("bw_banners")
      .update({ is_deleted: true, is_active: false, deleted_at: new Date().toISOString() })
      .eq("id", b.id);
    if (error) {
      alert("삭제 실패: " + error.message);
      return;
    }
    loadBanners();
  }

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);
  const isBundleSelected = !form.id && selectedPlan && selectedPlan.placements.length > 1;

  return (
    <div className="space-y-8">
      {/* 소재 등록/수정 폼 */}
      <form
        onSubmit={handleSave}
        className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4"
      >
        <h3 className="text-lg font-bold text-gray-900">
          {form.id ? "배너 수정" : "새 배너 등록"}
        </h3>

        {/* 요금제 프리셋 (신규 등록 시에만 노출) */}
        {!form.id && (
          <label className="block">
            <span className="text-sm font-bold text-gray-600">요금제</span>
            <select
              value={selectedPlanId}
              onChange={(e) => handlePlanChange(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#2c3e50]"
            >
              <option value="custom">직접 설정 (수동 입력)</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.price_krw.toLocaleString()}원 (VAT 별도) / {p.duration_days}일
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-gray-400">
              요금제를 고르면 노출 위치·게재 기간·계약 금액이 자동으로 채워집니다. 두 위치를
              포함하는 패키지 요금제는 저장 시 배너가 위치별로 나뉘어 등록됩니다.
            </p>
          </label>
        )}

        {isBundleSelected && (() => {
          // 계약 금액 입력값을 관리자가 수동으로 조정했을 수 있으므로 미리보기도 form.price_krw 기준으로 계산
          const previewTotal =
            form.price_krw === "" ? selectedPlan.price_krw : parseInt(form.price_krw) || 0;
          const n = selectedPlan.placements.length;
          const base = Math.floor(previewTotal / n);
          return (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              패키지 요금제입니다. 저장하면{" "}
              <strong>{selectedPlan.placements.map(placementLabel).join(" · ")}</strong> 위치에
              동일한 소재로 배너 {n}건이 함께 등록되고, 계약 금액{" "}
              {previewTotal.toLocaleString()}원은{" "}
              {selectedPlan.placements
                .map((placementId, idx) => {
                  const amount = base + (idx === 0 ? previewTotal - base * n : 0);
                  return `${placementLabel(placementId)} ${amount.toLocaleString()}원`;
                })
                .join(" · ")}
              으로 나눠 기록됩니다 (합계는 계약 금액과 정확히 일치).
            </p>
          );
        })()}

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
          <div className="mt-1 flex flex-wrap items-center gap-3 border border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
            <label
              htmlFor="banner-image-upload"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#2c3e50] text-white rounded font-bold text-sm cursor-pointer hover:bg-[#34495e] transition"
            >
              🖼️ 이미지 파일 선택
            </label>
            <input
              id="banner-image-upload"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <span className="text-xs text-gray-500">
              {uploading
                ? "업로드 중..."
                : form.image_url
                ? "이미지가 등록되었습니다"
                : "JPG, PNG, GIF, WEBP · 5MB 이하"}
            </span>
          </div>
          <input
            type="text"
            value={form.image_url}
            onChange={(e) => setForm({ ...form, image_url: e.target.value })}
            placeholder="또는 이미지 URL 직접 입력"
            className="mt-2 w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-[#2c3e50]"
          />
          {form.image_url && (
            <div className="mt-3 w-full max-w-2xl bg-gray-100 rounded overflow-hidden border border-gray-200">
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="block">
            <span className="text-sm font-bold text-gray-600">계약 금액 (원, VAT 별도)</span>
            <input
              type="number"
              value={form.price_krw}
              onChange={(e) => setForm({ ...form, price_krw: e.target.value, plan_id: "" })}
              placeholder="예: 400000"
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#2c3e50]"
            />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-gray-600">입금 상태</span>
            <select
              value={form.payment_status}
              onChange={(e) => setForm({ ...form, payment_status: e.target.value })}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#2c3e50]"
            >
              <option value="미입금">미입금</option>
              <option value="입금완료">입금완료</option>
              <option value="취소">취소</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-bold text-gray-600">메모 (선택)</span>
            <input
              type="text"
              value={form.memo}
              onChange={(e) => setForm({ ...form, memo: e.target.value })}
              placeholder="예: 세금계산서 발행완료"
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
                  <div className="flex items-center gap-2 flex-wrap">
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
                    {b.price_krw != null && (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          b.payment_status === "입금완료"
                            ? "bg-blue-100 text-blue-700"
                            : b.payment_status === "취소"
                            ? "bg-red-100 text-red-500"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {Number(b.price_krw).toLocaleString()}원 · {b.payment_status}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {b.advertiser || "광고주 미지정"} · {placementLabel(b.placement)}
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
  );
}
