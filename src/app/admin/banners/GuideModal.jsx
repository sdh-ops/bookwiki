"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PLACEMENTS, placementLabel } from "./shared";

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
              {PLACEMENTS.map((p) => (
                <li key={p.id}>
                  <strong>{p.name}</strong> — {p.desc}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h4 className="font-bold text-gray-900 mb-2">2. 배너 이미지 규격</h4>
            <ul className="space-y-1 list-disc list-inside">
              <li>
                가로형(홈 상단 · 게시글 상단 · 게시글 하단): <strong>1600 × 200px</strong>
              </li>
              <li>
                사이드(PC 전용): <strong>300 × 250px</strong>
              </li>
              <li>파일 형식: JPG, PNG, GIF, WEBP (5MB 이하 · 300KB 이하 권장)</li>
              <li>
                가로형은 <strong>모바일에서 가운데 절반만</strong> 보입니다. 로고·문구·CTA는 반드시
                가운데 <strong>800 × 200px</strong> 안에 넣도록 광고주에게 안내하세요.
              </li>
              <li>
                「소재 관리」 탭의 <strong>📐 소재 규격 보기 · 복사</strong> 버튼을 누르면 광고주에게
                그대로 보낼 안내문을 복사할 수 있고, 이미지를 넣으면 PC·모바일 미리보기로 잘리는
                모습을 바로 확인할 수 있습니다.
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
                「광고 성과」 탭 — 캠페인별 노출수·클릭수·CTR·PC/모바일 비중과 일별 추이를 확인,
                CSV 다운로드 가능
              </li>
              <li>
                같은 위치에 배너가 2개 이상이면 「소재 관리」 탭 맨 아래 <strong>위치별 노출 설정</strong>
                에서 랜덤·가중치·1순위 고정 중 선택할 수 있습니다
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
