"use client";

import { useState } from "react";
import { PLACEMENTS, CREATIVE_SPEC_TEXT } from "./shared";

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 클립보드 API 가 막힌 환경(비 HTTPS 등) 폴백
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

/** 안전영역을 눈으로 보여주는 간단한 도해 — 말로만 설명하면 광고주가 자주 놓친다. */
function SafeAreaDiagram() {
  return (
    <div className="mt-3">
      <div className="relative w-full h-16 rounded overflow-hidden border border-gray-300 flex">
        <div className="w-1/4 h-full bg-gray-200 flex items-center justify-center">
          <span className="text-[9px] text-gray-500 text-center leading-tight">
            배경만
            <br />
            400px
          </span>
        </div>
        <div className="w-1/2 h-full bg-emerald-100 border-x-2 border-dashed border-emerald-500 flex items-center justify-center">
          <span className="text-[10px] font-bold text-emerald-700 text-center leading-tight">
            안전영역 800 × 200
            <br />
            <span className="font-normal">로고 · 문구 · CTA</span>
          </span>
        </div>
        <div className="w-1/4 h-full bg-gray-200 flex items-center justify-center">
          <span className="text-[9px] text-gray-500 text-center leading-tight">
            배경만
            <br />
            400px
          </span>
        </div>
      </div>
      <p className="mt-1.5 text-[11px] text-gray-500">
        PC 는 전체가 보이고, 모바일은 <strong className="text-emerald-700">가운데 초록 영역만</strong>{" "}
        보입니다. 회색 부분은 모바일에서 잘립니다.
      </p>
    </div>
  );
}

export default function SpecModal({ onClose }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const ok = await copyText(CREATIVE_SPEC_TEXT);
    if (!ok) {
      alert("복사에 실패했습니다. 아래 내용을 직접 선택해 복사해주세요.");
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h3 className="text-lg font-bold text-gray-900">📐 배너 소재 규격</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className={`px-4 py-1.5 rounded text-sm font-bold transition ${
                copied
                  ? "bg-emerald-500 text-white"
                  : "bg-[#2c3e50] text-white hover:bg-[#34495e]"
              }`}
            >
              {copied ? "✓ 복사됨" : "📋 규격 안내문 복사"}
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1"
              aria-label="닫기"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 text-sm text-gray-700">
          <p className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded px-3 py-2">
            소재 <strong>한 장</strong>으로 PC·모바일을 모두 대응합니다. 위 「규격 안내문 복사」를
            누르면 광고주에게 그대로 보낼 수 있는 문구가 클립보드에 담깁니다.
          </p>

          <section>
            <h4 className="font-bold text-gray-900 mb-2">위치별 규격</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-gray-200 rounded">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-3 py-2 text-left">위치</th>
                    <th className="px-3 py-2 text-left">소재 크기</th>
                    <th className="px-3 py-2 text-left">안전영역</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {PLACEMENTS.map((p) => (
                    <tr key={p.id}>
                      <td className="px-3 py-2">
                        <span className="font-bold text-gray-800">{p.name}</span>
                        <p className="text-[11px] text-gray-400 mt-0.5">{p.desc}</p>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="font-bold text-gray-800">{p.imageSize}</span>
                        <p className="text-[11px] text-gray-400">고화질 {p.imageSizeRetina}</p>
                      </td>
                      <td className="px-3 py-2 text-gray-600">{p.safeArea}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h4 className="font-bold text-gray-900 mb-1">가로형 배너 안전영역</h4>
            <SafeAreaDiagram />
          </section>

          <section>
            <h4 className="font-bold text-gray-900 mb-2">광고주에게 보낼 안내문</h4>
            <pre className="whitespace-pre-wrap break-words text-[11px] leading-relaxed bg-gray-50 border border-gray-200 rounded p-4 text-gray-700 select-all">
              {CREATIVE_SPEC_TEXT}
            </pre>
            <button
              onClick={handleCopy}
              className={`mt-2 w-full py-2 rounded text-sm font-bold transition ${
                copied
                  ? "bg-emerald-500 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {copied ? "✓ 클립보드에 복사되었습니다" : "📋 위 내용 전체 복사"}
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
