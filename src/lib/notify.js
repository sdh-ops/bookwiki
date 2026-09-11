/**
 * 브라우저 기본 alert()/confirm() 대신 쓰는 알림.
 *
 * alert 는 모바일에서 화면 전체를 막고 모양을 바꿀 수 없어서, 저장·삭제 결과를
 * 화면 아래 토스트로, 되돌리기 어려운 동작의 확인을 사이트 모양의 창으로 바꾼다.
 * 실제로 그리는 건 layout 에 한 번 들어가는 <NotifyHost /> 다.
 *
 *   toast("저장했습니다.")                      // 성공(기본)
 *   toast("비밀번호가 틀렸습니다.", "error")
 *   if (await confirmDialog({ title: "삭제할까요?", confirmLabel: "삭제", danger: true })) …
 */

const TOAST_EVENT = "bw:toast";
const CONFIRM_EVENT = "bw:confirm";

export function toast(message, type = "success") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { message, type } }));
}

export function confirmDialog({
  title,
  message = "",
  confirmLabel = "확인",
  cancelLabel = "취소",
  danger = false,
} = {}) {
  if (typeof window === "undefined") return Promise.resolve(false);
  return new Promise((resolve) => {
    window.dispatchEvent(
      new CustomEvent(CONFIRM_EVENT, {
        detail: { title, message, confirmLabel, cancelLabel, danger, resolve },
      })
    );
  });
}

export const NOTIFY_EVENTS = { TOAST_EVENT, CONFIRM_EVENT };
