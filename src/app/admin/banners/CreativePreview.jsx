"use client";

import { getPlacement } from "./shared";

/**
 * 등록 전에 "실제로 어떻게 잘려 보이는지"를 PC·모바일 두 화면으로 함께 보여준다.
 * 안전영역을 벗어난 소재는 여기서 바로 걸러진다.
 */
export default function CreativePreview({ imageUrl, placement }) {
  if (!imageUrl) return null;
  const meta = getPlacement(placement);

  if (meta.pcOnly) {
    return (
      <div className="mt-3">
        <p className="text-[11px] font-bold text-gray-500 mb-1">
          미리보기 · PC 전용 (모바일에서는 노출되지 않음)
        </p>
        <div className="w-[240px] bg-gray-100 rounded overflow-hidden border border-gray-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="사이드 배너 미리보기" className="w-full aspect-[6/5] object-cover object-center" />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      <div>
        <p className="text-[11px] font-bold text-gray-500 mb-1">미리보기 · PC (전체 노출)</p>
        <div className="w-full max-w-2xl bg-gray-100 rounded overflow-hidden border border-gray-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="PC 미리보기" className="w-full aspect-[8/1] object-cover object-center" />
        </div>
      </div>
      <div>
        <p className="text-[11px] font-bold text-gray-500 mb-1">
          미리보기 · 모바일 (가운데 절반만 노출 — 좌우가 잘립니다)
        </p>
        <div className="w-[320px] bg-gray-100 rounded overflow-hidden border border-gray-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="모바일 미리보기" className="w-full aspect-[4/1] object-cover object-center" />
        </div>
      </div>
    </div>
  );
}
