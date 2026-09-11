"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Modal, { ModalActions } from "./Modal";
import { NOTIFY_EVENTS } from "@/lib/notify";

const TOAST_MS = 3200;

const TOAST_STYLES = {
  success: "bg-gray-900 text-white",
  error: "bg-red-600 text-white",
  info: "bg-gray-900 text-white",
};

/**
 * toast() · confirmDialog() 를 실제로 그리는 곳. layout 에 한 번만 둔다.
 * 토스트는 화면 아래 가운데 — 모바일에서 엄지 가까이, PC 에서도 본문을 가리지 않는다.
 */
export default function NotifyHost() {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const seq = useRef(0);
  const pendingRef = useRef(null);

  useEffect(() => {
    const onToast = (e) => {
      const id = ++seq.current;
      const { message, type } = e.detail;
      setToasts((prev) => [...prev.slice(-2), { id, message, type }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), TOAST_MS);
    };
    // 확인 창이 떠 있는데 또 부르면(버튼 연타) 앞의 호출을 「취소」로 끝내고 새 창을 띄운다 — 앞의 await 가 영영 안 풀리는 일을 막는다
    const onConfirm = (e) => {
      pendingRef.current?.resolve(false);
      pendingRef.current = e.detail;
      setDialog(e.detail);
    };

    window.addEventListener(NOTIFY_EVENTS.TOAST_EVENT, onToast);
    window.addEventListener(NOTIFY_EVENTS.CONFIRM_EVENT, onConfirm);
    return () => {
      window.removeEventListener(NOTIFY_EVENTS.TOAST_EVENT, onToast);
      window.removeEventListener(NOTIFY_EVENTS.CONFIRM_EVENT, onConfirm);
    };
  }, []);

  const settle = useCallback((answer) => {
    pendingRef.current?.resolve(answer);
    pendingRef.current = null;
    setDialog(null);
  }, []);

  return (
    <>
      <div
        className="fixed inset-x-0 bottom-4 z-[80] flex flex-col items-center gap-2 px-4 pointer-events-none pb-[env(safe-area-inset-bottom)]"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto max-w-md w-fit rounded-lg px-4 py-3 text-sm font-medium shadow-lg animate-[bw-toast-in_160ms_ease-out] ${TOAST_STYLES[t.type] || TOAST_STYLES.info}`}
          >
            {t.message}
          </div>
        ))}
      </div>

      <Modal open={!!dialog} onClose={() => settle(false)} title={dialog?.title}>
        {dialog?.message && <p className="text-sm text-gray-600 whitespace-pre-line">{dialog.message}</p>}
        <ModalActions
          onCancel={() => settle(false)}
          onConfirm={() => settle(true)}
          cancelLabel={dialog?.cancelLabel}
          confirmLabel={dialog?.confirmLabel}
          danger={dialog?.danger}
        />
      </Modal>
    </>
  );
}
