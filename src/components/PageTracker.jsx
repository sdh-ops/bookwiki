"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function PageTracker() {
  const pathname = usePathname();
  const trackedRef = useRef(new Set());

  useEffect(() => {
    // 관리자 페이지는 추적 제외
    if (pathname.startsWith("/admin")) return;
    // 같은 세션 내 동일 경로 중복 추적 방지
    if (trackedRef.current.has(pathname)) return;
    trackedRef.current.add(pathname);

    let sessionId = sessionStorage.getItem("bw_sid");
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem("bw_sid", sessionId);
    }

    supabase.from("bw_page_views").insert({ path: pathname, session_id: sessionId }).then();
  }, [pathname]);

  return null;
}
