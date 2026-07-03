"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { placementLabel } from "./shared";

export default function GuideModal({ onClose }) {
  const [plans, setPlans] = useState([]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("bw_banner_plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      setPlans(data || []);
    }
    load();
  }, []);

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h3 className="text-lg font-bold text-gray-900">📖 배너 광고 등록 가이드</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6 text-sm text-gray-700">
          <section>
            <h4 className="font-bold text-gray-900 mb-2">1. 게재 위치</h4>
            <ul className="space-y-1 list-disc list-inside">
              <li>
                <strong>홈 상단</strong> — 메인 홈페이지 최상단에 노출, 가장 눈에 잘 띄는 자리
              </li>
              <li>
                <strong>게시글 배너</strong> — 게시글 상세 페이지 제목 바로 아래 노출, 실제 글을
                읽는 이용자에게 자연스럽게 노출
              </li>
            </ul>
          </section>

          <section>
            <h4 className="font-bold text-gray-900 mb-2">2. 배너 이미지 규격</h4>
            <ul className="space-y-1 list-disc list-inside">
              <li>
                권장 크기: <strong>1200 × 120px</strong> (가로:세로 10:1 비율)
              </li>
              <li>파일 형식: JPG, PNG, WEBP (5MB 이하)</li>
              <li>
                실제 화면에서는 폭이 기기에 맞춰 자동으로 늘어나고, 높이는 PC 96px · 모바일 80px로
                고정되어 위아래가 살짝 잘려 보일 수 있습니다. 로고나 문구는 이미지{" "}
                <strong>중앙 60%</strong> 안쪽에 배치하는 것을 권장합니다.
              </li>
            </ul>
          </section>

          <section>
            <h4 className="font-bold text-gray-900 mb-2">3. 등록 절차</h4>
            <ol className="space-y-1 list-decimal list-inside">
              <li>「소재 관리」 탭에서 요금제 선택 (또는 직접 설정)</li>
              <li>캠페인 이름 / 광고주명 입력</li>
              <li>배너 이미지 업로드</li>
              <li>클릭 시 이동할 링크 URL 입력</li>
              <li>게재 시작일 · 종료일 확인 (요금제 선택 시 자동 계산됨)</li>
              <li>
                「등록」 클릭 → 시작일부터 자동 게재, 종료일이 지나면 자동으로 노출이 종료됩니다.
                별도로 끄지 않아도 됩니다.
              </li>
            </ol>
          </section>

          <section>
            <h4 className="font-bold text-gray-900 mb-2">4. 성과 확인 &amp; 매출 관리</h4>
            <ul className="space-y-1 list-disc list-inside">
              <li>
                「광고 성과」 탭 — 캠페인별 노출수·클릭수·CTR을 기간별로 확인, CSV 다운로드 가능
              </li>
              <li>
                「매출 관리」 탭 — 계약 금액과 입금 상태(미입금/입금완료/취소)를 관리하고 월별
                매출 합계를 확인
              </li>
            </ul>
          </section>

          <section>
            <h4 className="font-bold text-gray-900 mb-2">5. 현재 요금제 (VAT 별도)</h4>
            {plans.length === 0 ? (
              <p className="text-gray-400 text-xs">
                등록된 요금제가 없습니다. 「요금제 설정」 탭에서 추가하세요.
              </p>
            ) : (
              <table className="w-full text-xs border border-gray-200 rounded overflow-hidden">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-3 py-2 text-left">요금제</th>
                    <th className="px-3 py-2 text-left">위치</th>
                    <th className="px-3 py-2 text-right">기간</th>
                    <th className="px-3 py-2 text-right">금액</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {plans.map((p) => (
                    <tr key={p.id}>
                      <td className="px-3 py-2 font-bold text-gray-800">{p.name}</td>
                      <td className="px-3 py-2 text-gray-500">
                        {p.placements.map(placementLabel).join(" + ")}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-500">{p.duration_days}일</td>
                      <td className="px-3 py-2 text-right font-bold text-gray-800">
                        {Number(p.price_krw).toLocaleString()}원
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="mt-2 text-[11px] text-gray-400">
              요금제는 「요금제 설정」 탭에서 언제든 추가·수정할 수 있습니다.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
