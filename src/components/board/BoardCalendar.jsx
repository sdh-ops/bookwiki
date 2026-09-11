"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { withWeekday } from "@/lib/date";
import { rememberListPosition } from "@/lib/boards";

const MONTH_NAMES = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

// 명시적 deadline 이 없던 옛 글은 본문의 "마감일: YYYY-MM-DD" 에서 읽는다
function withDeadline(post) {
  let date = post.deadline;
  if (!date && post.content) {
    const m = post.content.match(/마감일:<\/strong>\s*(\d{4}-\d{2}-\d{2})/);
    if (m) date = m[1];
  }
  return date ? { ...post, deadline: date } : null;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** 지원사업·구인구직 마감 캘린더 */
export default function BoardCalendar({ board }) {
  const [events, setEvents] = useState([]);
  const [loadError, setLoadError] = useState(false);
  const [cursor, setCursor] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data, error } = await supabase
        .from("bw_posts")
        .select("id, title, content, created_at, deadline")
        .eq("board_type", board)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (error) {
        console.error("[BoardCalendar]", error.message);
        setLoadError(true);
        return;
      }
      setEvents((data || []).map(withDeadline).filter(Boolean));
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [board]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayStart = startOfToday();

  const eventsOn = (day) => {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return events.filter((e) => e.deadline === key);
  };
  const isToday = (day) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
  const isPast = (day) => new Date(year, month, day) < todayStart;

  const upcoming = events
    .filter((e) => new Date(e.deadline) >= todayStart)
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
    .slice(0, 5);

  const navBtn = "min-h-10 px-3 text-sm bg-white border border-gray-200 rounded-md hover:bg-gray-100";

  return (
    <div className="bg-white">
      <div className="flex items-center justify-between mb-4 p-2 bg-gray-50 rounded-lg">
        <button type="button" onClick={() => setCursor(new Date(year, month - 1, 1))} className={navBtn} aria-label="이전 달">
          ◀ 이전
        </button>
        <h3 className="text-lg font-bold">
          {year}년 {MONTH_NAMES[month]}
        </h3>
        <button type="button" onClick={() => setCursor(new Date(year, month + 1, 1))} className={navBtn} aria-label="다음 달">
          다음 ▶
        </button>
      </div>

      {loadError && (
        <p className="mb-3 text-sm text-red-600">마감 일정을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.</p>
      )}

      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map((name, idx) => (
          <div key={name} className={`text-center text-xs font-bold py-2 ${idx === 0 ? "text-red-500" : idx === 6 ? "text-blue-500" : "text-gray-600"}`}>
            {name}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 border border-gray-200 rounded-lg overflow-hidden">
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="h-20 md:h-24 bg-gray-50 border-b border-r border-gray-100" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dayEvents = eventsOn(day);
          return (
            <div key={day} className={`h-20 md:h-24 border-b border-r border-gray-100 p-1 overflow-hidden ${isToday(day) ? "bg-blue-50" : "bg-white"}`}>
              <div className={`text-xs font-bold mb-1 ${isPast(day) ? "text-gray-400" : ""} ${isToday(day) ? "text-blue-600" : ""}`}>{day}</div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 2).map((event) => (
                  <Link
                    key={event.id}
                    href={`/post/${event.id}`}
                    onClick={rememberListPosition}
                    className="block text-[10px] bg-red-100 text-red-700 px-1 py-0.5 rounded truncate hover:bg-red-200"
                    title={event.title}
                  >
                    {event.title.replace(/\[.*?\]/g, "").trim()}
                  </Link>
                ))}
                {dayEvents.length > 2 && <div className="text-[10px] text-gray-500">+{dayEvents.length - 2}개</div>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 bg-gray-50 rounded-lg p-4">
        <h4 className="font-bold text-sm mb-3">다가오는 마감</h4>
        {upcoming.length === 0 ? (
          <p className="text-xs text-gray-500">마감 예정인 {board === "job" ? "구인공고가" : "지원사업이"} 없습니다.</p>
        ) : (
          <ul className="divide-y divide-gray-200/70">
            {upcoming.map((event) => (
              <li key={event.id}>
                <Link href={`/post/${event.id}`} onClick={rememberListPosition} className="flex items-start gap-3 py-2.5 text-sm group">
                  <span className="text-red-600 font-bold whitespace-nowrap text-xs pt-0.5">{withWeekday(event.deadline)}</span>
                  <span className="text-gray-700 group-hover:text-blue-600 truncate">{event.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
