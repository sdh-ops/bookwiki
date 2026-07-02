"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

// PageTracker 와 동일한 세션 식별자 재사용 (순사용자·CTR 집계용)
function getSessionId() {
  let sid = sessionStorage.getItem("bw_sid");
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem("bw_sid", sid);
  }
  return sid;
}

/**
 * 배너 광고 슬롯.
 * - placement 위치의 게재중 배너를 불러와 랜덤 1개 노출 (여러 개면 회전)
 * - 노출 시 impression, 클릭 시 click 이벤트를 bw_banner_events 에 기록
 * - 게재중 배너가 없으면 아무것도 렌더링하지 않음
 */
export default function Banner({ placement = "home_top", className = "" }) {
  const [banner, setBanner] = useState(null);
  const pathname = usePathname();
  const impressionTracked = useRef(false);

  // 게재중 배너 로드 (RLS 가 활성·날짜창 필터를 이미 수행)
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("bw_banners")
        .select("id, name, image_url, link_url")
        .eq("placement", placement)
        .eq("is_active", true)
        .or(`start_date.is.null,start_date.lte.${today}`)
        .or(`end_date.is.null,end_date.gte.${today}`)
        .order("sort_order", { ascending: true });

      if (cancelled) return;
      if (error) {
        console.error("[Banner] load error:", error.message);
        return;
      }
      if (!data || data.length === 0) return;

      // 여러 소재가 있으면 로드마다 랜덤 회전
      const pick = data[Math.floor(Math.random() * data.length)];
      setBanner(pick);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [placement]);

  // 노출 기록 (배너 1회 선택당 1회)
  useEffect(() => {
    if (!banner || impressionTracked.current) return;
    impressionTracked.current = true;

    supabase
      .from("bw_banner_events")
      .insert({
        banner_id: banner.id,
        event_type: "impression",
        session_id: getSessionId(),
        path: pathname,
      })
      .then(({ error }) => {
        if (error) console.error("[Banner] impression error:", error.message);
      });
  }, [banner, pathname]);

  async function handleClick(e) {
    e.preventDefault();
    if (!banner) return;

    // 클릭 기록 (fire-and-forget) 후 새 탭으로 이동
    supabase
      .from("bw_banner_events")
      .insert({
        banner_id: banner.id,
        event_type: "click",
        session_id: getSessionId(),
        path: pathname,
      })
      .then(({ error }) => {
        if (error) console.error("[Banner] click error:", error.message);
      });

    window.open(banner.link_url, "_blank", "noopener,noreferrer");
  }

  if (!banner) return null;

  return (
    <div className={`w-full max-w-6xl mx-auto px-4 mt-4 ${className}`}>
      <a
        href={banner.link_url}
        onClick={handleClick}
        target="_blank"
        rel="noopener noreferrer sponsored"
        aria-label={`광고: ${banner.name}`}
        className="block w-full overflow-hidden rounded transition hover:opacity-95"
      >
        <img
          src={banner.image_url}
          alt={banner.name}
          className="w-full h-20 md:h-24 object-cover"
        />
      </a>
    </div>
  );
}
