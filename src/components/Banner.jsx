"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getDeviceType } from "@/lib/device";
import { getPlacement } from "@/lib/bannerPlacements";

// 같은 세션에서 같은 배너를 반복 클릭해도 30분에 1회만 집계한다.
// (광고주 리포트의 클릭수가 새로고침·오클릭으로 부풀지 않도록)
const CLICK_COOLDOWN_MS = 30 * 60 * 1000;

// 위치별 노출 설정은 페이지당 여러 슬롯이 함께 쓰므로 한 번만 받아 재사용한다.
let placementSettingsPromise = null;

function loadPlacementSettings() {
  if (!placementSettingsPromise) {
    placementSettingsPromise = supabase
      .from("bw_placement_settings")
      .select("placement, rotation_mode, show_placeholder")
      .then(({ data, error }) => {
        if (error) {
          console.error("[Banner] settings load error:", error.message);
          return {};
        }
        return Object.fromEntries((data || []).map((r) => [r.placement, r]));
      });
  }
  return placementSettingsPromise;
}

// PageTracker 와 동일한 세션 식별자 재사용 (순사용자·CTR 집계용)
function getSessionId() {
  try {
    let sid = sessionStorage.getItem("bw_sid");
    if (!sid) {
      sid = crypto.randomUUID();
      sessionStorage.setItem("bw_sid", sid);
    }
    return sid;
  } catch {
    return null;
  }
}

/** 로테이션 방식에 따라 노출할 배너 1개를 고른다. list 는 sort_order 오름차순. */
function pickBanner(list, mode) {
  if (!list.length) return null;
  if (list.length === 1) return list[0];

  if (mode === "fixed") return list[0];

  if (mode === "weighted") {
    const weights = list.map((b) => Math.max(1, Number(b.weight) || 1));
    const total = weights.reduce((s, w) => s + w, 0);
    let r = Math.random() * total;
    for (let i = 0; i < list.length; i++) {
      r -= weights[i];
      if (r <= 0) return list[i];
    }
    return list[list.length - 1];
  }

  return list[Math.floor(Math.random() * list.length)];
}

/**
 * 광고주 쪽 애널리틱스에서도 북위키 유입을 식별할 수 있도록 UTM 을 붙인다.
 * 광고주가 이미 utm_source 를 넣어 보냈다면 그 값을 존중해 건드리지 않는다.
 */
function withUtm(rawUrl, banner, placement) {
  try {
    const u = new URL(rawUrl);
    if (!u.searchParams.has("utm_source")) {
      u.searchParams.set("utm_source", "bookwiki");
      u.searchParams.set("utm_medium", "banner");
      u.searchParams.set("utm_campaign", banner.name || "banner");
      u.searchParams.set("utm_content", placement);
    }
    return u.toString();
  } catch {
    // 상대경로 등 URL 파싱 실패 시 원본 그대로
    return rawUrl;
  }
}

function shouldLogClick(bannerId) {
  try {
    const key = `bw_bclick_${bannerId}`;
    const last = Number(localStorage.getItem(key) || 0);
    if (Date.now() - last < CLICK_COOLDOWN_MS) return false;
    localStorage.setItem(key, String(Date.now()));
    return true;
  } catch {
    return true;
  }
}

/** YYYY-MM-DD (KST). toISOString() 은 UTC 라 00~09시에 하루 밀린다. */
function todayKST() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

/**
 * 배너 광고 슬롯.
 * - 게재중 배너를 위치별 로테이션 방식(랜덤/가중치/고정)으로 1개 노출
 * - 노출·클릭 이벤트를 기기 구분과 함께 bw_banner_events 에 기록
 * - 게재중 배너가 없으면 위치 설정에 따라 "광고 배너 영역" 자리를 보여준다
 *
 * 게재 기간은 RLS 와 여기서 이중으로 거른다. 관리자 계정은 admin_manage_banners
 * (FOR ALL) 정책 때문에 RLS 날짜창을 통과해 버리므로, 클라이언트 필터가 없으면
 * 운영자가 사이트를 볼 때만 만료·미시작 배너가 노출된다.
 */
export default function Banner({ placement = "home_top", className }) {
  const [banner, setBanner] = useState(null);
  const [showPlaceholder, setShowPlaceholder] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // PC 전용 슬롯 판정. null = 아직 측정 전(서버 렌더 시점)
  const [isWideScreen, setIsWideScreen] = useState(null);
  const pathname = usePathname();
  const impressionKey = useRef(null);

  const meta = getPlacement(placement);
  const wrapClass = className ?? meta.wrapClass;
  // PC 전용 슬롯은 모바일에서 CSS 로만 숨겨도 컴포넌트는 그대로 마운트된다.
  // 그대로 두면 화면에 뜨지도 않은 노출이 집계돼 광고주에게 허위 노출을 보고하게 된다.
  const hiddenHere = meta.pcOnly && isWideScreen === false;

  // Tailwind lg 브레이크포인트(1024px)와 같은 기준을 쓴다
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsWideScreen(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    let cancelled = false;

    // PC 전용 슬롯은 화면 폭 판정이 끝나기 전까지 아무것도 부르지 않는다.
    // 모바일로 확정되면 렌더 단계에서 hiddenHere 로 아예 null 을 반환하므로
    // 여기서 별도 상태를 만질 필요가 없다.
    if (meta.pcOnly && isWideScreen !== true) return;

    async function load() {
      const today = todayKST();
      // .or() 를 두 번 부르면 PostgREST 가 두 조건을 AND 로 묶는다(실측 확인).
      const [settings, result] = await Promise.all([
        loadPlacementSettings(),
        supabase
          .from("bw_banners")
          .select("id, name, image_url, link_url, sort_order, weight")
          .eq("placement", placement)
          .eq("is_active", true)
          .eq("is_deleted", false)
          .or(`start_date.is.null,start_date.lte.${today}`)
          .or(`end_date.is.null,end_date.gte.${today}`)
          .order("sort_order", { ascending: true }),
      ]);

      if (cancelled) return;

      const setting = settings?.[placement];
      setShowPlaceholder(setting?.show_placeholder ?? false);

      if (result.error) {
        console.error("[Banner] load error:", result.error.message);
        setLoaded(true);
        return;
      }

      setBanner(pickBanner(result.data || [], setting?.rotation_mode || "random"));
      setLoaded(true);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [placement, meta.pcOnly, isWideScreen]);

  // 노출 기록 — 같은 배너를 같은 경로에서 중복 기록하지 않는다
  useEffect(() => {
    if (!banner || hiddenHere) return;
    const key = `${banner.id}|${pathname}`;
    if (impressionKey.current === key) return;
    impressionKey.current = key;

    supabase
      .from("bw_banner_events")
      .insert({
        banner_id: banner.id,
        event_type: "impression",
        session_id: getSessionId(),
        path: pathname,
        device_type: getDeviceType(),
      })
      .then(({ error }) => {
        if (error) console.error("[Banner] impression error:", error.message);
      });
  }, [banner, pathname, hiddenHere]);

  // 클릭 기록. preventDefault 를 하지 않으므로 Ctrl+클릭·휠클릭 같은
  // 브라우저 기본 동작이 그대로 살아있고 팝업 차단에도 걸리지 않는다.
  function handleClick() {
    if (!banner || !shouldLogClick(banner.id)) return;

    supabase
      .from("bw_banner_events")
      .insert({
        banner_id: banner.id,
        event_type: "click",
        session_id: getSessionId(),
        path: pathname,
        device_type: getDeviceType(),
      })
      .then(({ error }) => {
        if (error) console.error("[Banner] click error:", error.message);
      });
  }

  // PC 전용 슬롯인데 모바일이면 DOM 자체를 내보내지 않는다(노출 집계도 함께 차단)
  if (hiddenHere) return null;

  // 불러오는 중: 슬롯 높이를 미리 잡아 레이아웃이 튀지 않게 한다
  if (!loaded) {
    return (
      <div className={wrapClass}>
        <div className={`w-full rounded bg-gray-100 ${meta.frameClass}`} />
      </div>
    );
  }

  if (!banner) {
    if (!showPlaceholder) return null;
    return (
      <div className={wrapClass}>
        <div
          className={`w-full rounded bg-black flex items-center justify-center text-white text-sm ${meta.frameClass}`}
        >
          광고 배너 영역
        </div>
      </div>
    );
  }

  return (
    <div className={wrapClass}>
      <a
        href={withUtm(banner.link_url, banner, placement)}
        onClick={handleClick}
        onAuxClick={handleClick}
        target="_blank"
        rel="noopener noreferrer sponsored"
        aria-label={`광고: ${banner.name}`}
        className="block w-full overflow-hidden rounded transition hover:opacity-95"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={banner.image_url}
          alt={banner.name}
          loading={placement === "home_top" ? "eager" : "lazy"}
          className={`w-full h-full object-cover object-center ${meta.frameClass}`}
        />
      </a>
    </div>
  );
}
