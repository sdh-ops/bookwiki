"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PLACEMENTS, ROTATION_MODES } from "./shared";

/**
 * 위치별 노출 설정.
 *  - 같은 기간에 배너가 2개 이상일 때 어떻게 번갈아 보여줄지
 *  - 게재중 배너가 없을 때 "광고 배너 영역" 자리를 남길지
 */
export default function RotationSettings({ counts = {} }) {
  const [rows, setRows] = useState([]);
  const [savingId, setSavingId] = useState(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("bw_placement_settings")
      .select("placement, rotation_mode, show_placeholder");
    if (error) {
      console.error("[RotationSettings] load error:", error.message);
      return;
    }
    setRows(data || []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 최초 마운트 시 설정 로드
    load();
  }, [load]);

  const settingOf = (id) =>
    rows.find((r) => r.placement === id) || {
      placement: id,
      rotation_mode: "random",
      show_placeholder: false,
    };

  async function save(placement, patch) {
    setSavingId(placement);
    const current = settingOf(placement);
    const { error } = await supabase.from("bw_placement_settings").upsert(
      {
        placement,
        rotation_mode: current.rotation_mode,
        show_placeholder: current.show_placeholder,
        ...patch,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "placement" }
    );
    setSavingId(null);
    if (error) {
      alert("설정 저장 실패: " + error.message);
      return;
    }
    load();
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h3 className="font-bold text-gray-900">위치별 노출 설정</h3>
        <p className="text-[11px] text-gray-400 mt-1">
          같은 기간에 배너가 2개 이상이면 아래 방식대로 번갈아 노출됩니다.
        </p>
      </div>
      <div className="divide-y divide-gray-100">
        {PLACEMENTS.map((p) => {
          const s = settingOf(p.id);
          const live = counts[p.id] || 0;
          return (
            <div key={p.id} className="p-4 flex flex-wrap items-center gap-4">
              <div className="min-w-[180px] flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-900 text-sm">{p.name}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      live > 0 ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    게재중 {live}건
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">{p.desc}</p>
              </div>

              <label className="text-xs">
                <span className="block text-gray-500 font-bold mb-1">노출 방식</span>
                <select
                  value={s.rotation_mode}
                  disabled={savingId === p.id}
                  onChange={(e) => save(p.id, { rotation_mode: e.target.value })}
                  className="px-3 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:border-[#2c3e50] disabled:opacity-50"
                >
                  {ROTATION_MODES.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={s.show_placeholder}
                  disabled={savingId === p.id}
                  onChange={(e) => save(p.id, { show_placeholder: e.target.checked })}
                />
                광고 없을 때 &ldquo;광고 배너 영역&rdquo; 표시
              </label>
            </div>
          );
        })}
      </div>
      <p className="px-6 py-3 text-[11px] text-gray-400 border-t border-gray-100">
        {ROTATION_MODES.map((m) => `${m.name} = ${m.desc}`).join(" · ")}
      </p>
    </div>
  );
}
