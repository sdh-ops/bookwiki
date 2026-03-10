"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function CalendarPage() {
  const [events, setEvents] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEvents() {
      setLoading(true);

      // Get support posts with deadline info in content
      const { data: posts } = await supabase
        .from("bw_posts")
        .select("id, title, content, created_at, source_url")
        .eq("board_type", "support")
        .order("created_at", { ascending: false });

      if (posts) {
        // Extract deadline dates from content
        const eventsWithDeadlines = posts
          .map(post => {
            // Look for deadline pattern in content
            const deadlineMatch = post.content?.match(/마감일:<\/strong>\s*(\d{4}-\d{2}-\d{2})/);
            if (deadlineMatch) {
              return {
                ...post,
                deadline: deadlineMatch[1]
              };
            }
            return null;
          })
          .filter(Boolean);

        setEvents(eventsWithDeadlines);
      }
      setLoading(false);
    }
    fetchEvents();
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDay = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const getEventsForDay = (day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(e => e.deadline === dateStr);
  };

  const isToday = (day) => {
    const today = new Date();
    return today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
  };

  const isPast = (day) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(year, month, day);
    return checkDate < today;
  };

  const days = [];
  for (let i = 0; i < startDay; i++) {
    days.push(<div key={`empty-${i}`} className="h-24 bg-gray-50"></div>);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dayEvents = getEventsForDay(day);
    const todayClass = isToday(day) ? "bg-blue-50 border-blue-300" : "bg-white";
    const pastClass = isPast(day) ? "text-gray-400" : "";

    days.push(
      <div key={day} className={`h-24 border border-gray-200 p-1 overflow-hidden ${todayClass}`}>
        <div className={`text-xs font-bold mb-1 ${pastClass} ${isToday(day) ? 'text-blue-600' : ''}`}>
          {day}
        </div>
        <div className="space-y-0.5">
          {dayEvents.slice(0, 2).map((event, idx) => (
            <Link
              key={idx}
              href={`/post/${event.id}`}
              className="block text-[10px] bg-red-100 text-red-700 px-1 py-0.5 rounded truncate hover:bg-red-200"
              title={event.title}
            >
              {event.title.replace(/\[.*?\]/g, '').trim().substring(0, 15)}...
            </Link>
          ))}
          {dayEvents.length > 2 && (
            <div className="text-[10px] text-gray-500">+{dayEvents.length - 2}개 더</div>
          )}
        </div>
      </div>
    );
  }

  const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">지원사업 마감 캘린더</h1>
        <Link href="/?board=support" className="text-sm text-blue-600 hover:underline">
          목록으로
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-10">로딩 중...</div>
      ) : (
        <>
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-4 bg-white p-3 rounded-lg shadow-sm">
            <button
              onClick={prevMonth}
              className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200"
            >
              ◀ 이전
            </button>
            <h2 className="text-lg font-bold">
              {year}년 {monthNames[month]}
            </h2>
            <button
              onClick={nextMonth}
              className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200"
            >
              다음 ▶
            </button>
          </div>

          {/* Day Names */}
          <div className="grid grid-cols-7 gap-0 mb-1">
            {dayNames.map((name, idx) => (
              <div
                key={name}
                className={`text-center text-xs font-bold py-2 ${idx === 0 ? 'text-red-500' : idx === 6 ? 'text-blue-500' : 'text-gray-600'}`}
              >
                {name}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-0 border border-gray-200 rounded-lg overflow-hidden">
            {days}
          </div>

          {/* Legend */}
          <div className="mt-4 flex items-center gap-4 text-xs text-gray-600">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-red-100 border border-red-200 rounded"></div>
              <span>마감일</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-blue-50 border border-blue-300 rounded"></div>
              <span>오늘</span>
            </div>
          </div>

          {/* Upcoming Deadlines */}
          <div className="mt-6 bg-white rounded-lg shadow-sm p-4">
            <h3 className="font-bold text-sm mb-3">다가오는 마감</h3>
            {events.filter(e => !isPast(parseInt(e.deadline.split('-')[2])) || e.deadline.split('-')[1] !== String(month + 1).padStart(2, '0')).length === 0 ? (
              <p className="text-xs text-gray-500">마감 예정인 지원사업이 없습니다.</p>
            ) : (
              <ul className="space-y-2">
                {events
                  .filter(e => {
                    const deadlineDate = new Date(e.deadline);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    return deadlineDate >= today;
                  })
                  .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
                  .slice(0, 5)
                  .map(event => (
                    <li key={event.id} className="flex items-start gap-3 text-sm">
                      <span className="text-red-600 font-bold whitespace-nowrap">{event.deadline}</span>
                      <Link href={`/post/${event.id}`} className="text-gray-700 hover:text-blue-600 truncate">
                        {event.title}
                      </Link>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
