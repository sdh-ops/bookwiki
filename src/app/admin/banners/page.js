"use client";

import { useState } from "react";
import ManageTab from "./ManageTab";
import StatsTab from "./StatsTab";
import RevenueTab from "./RevenueTab";
import PlansTab from "./PlansTab";
import GuideModal from "./GuideModal";

const TABS = [
  { id: "manage", label: "소재 관리" },
  { id: "stats", label: "광고 성과" },
  { id: "revenue", label: "매출 관리" },
  { id: "plans", label: "요금제 설정" },
];

export default function AdminBannersPage() {
  const [tab, setTab] = useState("manage");
  const [showGuide, setShowGuide] = useState(false);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold text-gray-900">배너 광고 관리</h2>
        <button
          onClick={() => setShowGuide(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50"
        >
          📖 등록 가이드
        </button>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map((t) => (
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

      {tab === "manage" && <ManageTab />}
      {tab === "stats" && <StatsTab />}
      {tab === "revenue" && <RevenueTab />}
      {tab === "plans" && <PlansTab />}

      {showGuide && <GuideModal onClose={() => setShowGuide(false)} />}
    </div>
  );
}
