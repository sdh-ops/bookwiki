"use client";

import { useEffect, useRef } from "react";

// 겹쳐 뜬 창 중 가장 위 창만 Esc 로 닫히게 하는 스택
const openStack = [];

/**
 * 가운데 뜨는 작은 창. 바깥(어두운 배경)을 누르거나 Esc 를 누르면 닫힌다.
 * 열리면 첫 입력칸(없으면 첫 버튼)에 포커스를 준다 — 모바일에서 키보드가 바로 올라온다.
 */
export default function Modal({ open, onClose, title, children, labelledBy }) {
  const panelRef = useRef(null);
  const idRef = useRef(Symbol("modal"));
  // 부모가 매 렌더 새 함수를 넘겨도 포커스가 튀지 않게 ref 로 들고 있는다
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const id = idRef.current;
    openStack.push(id);

    const onKey = (e) => {
      if (openStack[openStack.length - 1] !== id) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      // Tab 이 창 밖(뒤의 페이지)으로 새지 않게 창 안에서만 돈다
      if (e.key === "Tab" && panelRef.current) {
        const items = [...panelRef.current.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea, select, a[href], [tabindex]:not([tabindex="-1"])')];
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        } else if (!panelRef.current.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    // 닫히면 창을 연 버튼으로 포커스를 돌려준다
    const opener = document.activeElement;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const panel = panelRef.current;
    const first =
      panel?.querySelector("input, textarea, select") ||
      panel?.querySelector("button[data-autofocus]") ||
      panel?.querySelector("button");
    first?.focus();

    return () => {
      window.removeEventListener("keydown", onKey);
      const idx = openStack.indexOf(id);
      if (idx >= 0) openStack.splice(idx, 1);
      document.body.style.overflow = prevOverflow;
      if (opener && typeof opener.focus === "function" && document.contains(opener)) opener.focus();
    };
  }, [open]);

  if (!open) return null;

  const headingId = labelledBy || "bw-modal-title";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? headingId : undefined}
        className="w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-xl shadow-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-5"
      >
        {title && (
          <h2 id={headingId} className="text-base font-bold text-gray-900 mb-3">
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  );
}

// 창 아래 버튼 한 쌍 — 모바일에서도 손가락으로 누르기 쉬운 높이(44px)
export function ModalActions({ onCancel, onConfirm, cancelLabel = "취소", confirmLabel = "확인", danger = false, busy = false, confirmType = "button" }) {
  return (
    <div className="flex gap-2 mt-5">
      <button
        type="button"
        onClick={onCancel}
        className="flex-1 min-h-11 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
      >
        {cancelLabel}
      </button>
      <button
        type={confirmType}
        onClick={confirmType === "button" ? onConfirm : undefined}
        disabled={busy}
        /* 삭제처럼 되돌리기 어려운 확인은 Enter 한 번에 실행되지 않게 취소 쪽에 포커스를 둔다 */
        data-autofocus={danger ? undefined : true}
        className={`flex-1 min-h-11 text-sm font-bold text-white rounded-lg transition disabled:opacity-50 ${
          danger ? "bg-red-600 hover:bg-red-700" : "bg-[#355E3B] hover:bg-[#2A4A2E]"
        }`}
      >
        {busy ? "처리 중..." : confirmLabel}
      </button>
    </div>
  );
}
