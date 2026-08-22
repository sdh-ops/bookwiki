/**
 * 배너 광고 게재 위치 정의 — 공개 사이트(Banner)와 관리자 화면이 함께 쓰는 정본.
 *
 * 소재는 두 가지 방식 중 하나로 낸다.
 *   A. 한 장 (안전영역) — PC 는 전체, 모바일은 가운데 절반만 보이도록 좌우가 잘린다.
 *      광고주에게 "로고·문구·CTA 는 가운데 절반 안에" 라고 안내해야 한다.
 *   B. 두 장 (기기별)   — PC 소재와 모바일 소재를 각각 올린다. 잘림이 없다.
 *      모바일 소재를 올리지 않으면 자동으로 A 방식으로 동작한다(하위호환).
 *
 * 전환 기준은 Tailwind `md`(768px) 하나로 통일한다 — 이미지 교체(<picture> media)와
 * 프레임 비율(md:aspect-…)이 같은 지점에서 함께 바뀌어야 한 프레임에 다른 소재가
 * 들어가는 어긋남이 생기지 않는다.
 *
 * Tailwind JIT 는 소스에 문자열로 박힌 클래스만 생성하므로 aspect 클래스는
 * 반드시 리터럴로 둔다 (템플릿 문자열로 조립하면 스타일이 안 나온다).
 */

// 이미지 교체 지점 = Tailwind md. Banner 의 <source media> 와 frameClass 가 공유한다.
// ⚠️ px 가 아니라 rem 이다 — Tailwind 4 의 md 는 48rem 이라, px 로 적으면 브라우저
//    기본 글자 크기를 키운 사용자에서 교체 지점과 프레임 비율이 어긋난다
//    (8:1 프레임에 4:1 모바일 소재가 들어가 위아래가 잘린다).
export const PC_MEDIA_QUERY = "(min-width: 48rem)";

// 가로형 배너 공통 규격 — 8:1 원본, 모바일에서 가운데 4:1 만 노출(= 가로 50%)
const WIDE = {
  imageSize: "1600 × 200 px",
  imageSizeRetina: "3200 × 400 px",
  safeArea: "가운데 800 × 200 px",
  // 모바일 소재를 따로 받을 수 있는 자리. 프레임이 4:1 이라 800 × 200 이 정확히 맞는다.
  mobileCreative: true,
  mobileImageSize: "800 × 200 px",
  mobileImageSizeRetina: "1600 × 400 px",
  // 모바일 4:1 / PC 8:1 — object-cover 가 가운데를 기준으로 잘라낸다
  frameClass: "aspect-[4/1] md:aspect-[8/1]",
};

export const PLACEMENTS = [
  {
    id: "home_top",
    name: "홈 상단",
    desc: "메인 홈페이지 최상단. 가장 눈에 잘 띄는 자리",
    pcOnly: false,
    ...WIDE,
    wrapClass: "w-full max-w-6xl mx-auto px-4 mt-4",
  },
  {
    id: "post_bottom",
    name: "게시글 배너(댓글 위)",
    desc: "본문을 끝까지 읽은 뒤 댓글로 넘어가기 직전 — 체류가 가장 긴 자리",
    pcOnly: false,
    ...WIDE,
    wrapClass: "w-full mt-8",
  },
  {
    id: "sidebar",
    name: "사이드 (PC 전용)",
    desc: "홈 우측 사이드바 '내 활동' 아래. 모바일에서는 노출되지 않음",
    pcOnly: true,
    imageSize: "300 × 250 px",
    imageSizeRetina: "600 × 500 px",
    safeArea: "잘림 없음 (전체 노출)",
    // 모바일에 아예 안 뜨는 자리라 기기별 소재라는 개념이 없다
    mobileCreative: false,
    frameClass: "aspect-[6/5]",
    wrapClass: "w-full mt-4 hidden lg:block",
  },
];

/**
 * 운영에서 내린 위치. 새 배너는 여기에 등록할 수 없지만, 과거 계약·성과 기록이
 * 남아 있으므로 매출·리포트에서 이름이 원시 코드로 보이지 않게 라벨만 유지한다.
 */
const RETIRED_PLACEMENT_LABELS = {
  post_detail: "게시글 상단(운영 종료)",
};

export function getPlacement(id) {
  return PLACEMENTS.find((p) => p.id === id) || PLACEMENTS[0];
}

export function placementLabel(id) {
  return (
    PLACEMENTS.find((p) => p.id === id)?.name || RETIRED_PLACEMENT_LABELS[id] || id
  );
}

export const ROTATION_MODES = [
  { id: "random", name: "랜덤 (균등)", desc: "게재중인 배너를 같은 확률로 번갈아 노출" },
  { id: "weighted", name: "가중치", desc: "배너별 '노출 비중' 값에 비례해서 노출" },
  { id: "fixed", name: "1순위 고정", desc: "정렬 순서가 가장 앞선 배너만 계속 노출" },
];

/**
 * 광고주에게 그대로 보낼 수 있는 소재 규격 안내문.
 * 관리자 화면의 「소재 규격」 버튼에서 복사해 메일에 붙여넣는 용도.
 */
export const CREATIVE_SPEC_TEXT = `[북위키 배너 광고 소재 규격]

■ 가로형 배너 — 홈 상단 / 게시글 배너 (공통)
  아래 두 가지 방식 중 편하신 쪽으로 보내주시면 됩니다.

  [방식 A] 소재 두 장 — PC용 · 모바일용 (권장 · 잘림 없음)
  · PC용      : 1600 × 200 px  (고화질 3200 × 400 px)
  · 모바일용  : 800 × 200 px   (고화질 1600 × 400 px)
  · 노출 모습 : 각 기기에서 보내주신 소재가 잘림 없이 그대로 노출됩니다
  · 장점      : 모바일에서도 문구를 온전히 쓸 수 있습니다

  [방식 B] 소재 한 장 — 안전영역 방식
  · 크기      : 1600 × 200 px  (고화질 원하시면 3200 × 400 px)
  · 안전영역  : 가운데 800 × 200 px  ★필수★
                로고 · 핵심 문구 · CTA 는 전부 이 안에 넣어주세요.
                양옆 400px 씩은 배경색이나 패턴만 넣어주세요 (모바일에서 잘립니다)
  · 노출 모습 : PC     — 1600 × 200 전체가 그대로 노출
                모바일 — 가운데 800 × 200 영역만 노출 (좌우가 잘림)
  · 글자 크기 : 1600px 기준 최소 48px (모바일 축소를 감안한 최소치입니다)

■ 사이드 배너 (PC 전용)
  · 크기      : 300 × 250 px  (고화질 600 × 500 px)
  · 안전영역  : 잘림 없이 전체가 그대로 노출됩니다
  · 참고      : 모바일에서는 노출되지 않는 자리입니다

■ 공통 사항
  · 파일 형식 : JPG 또는 PNG (사진 위주는 JPG, 로고·글자 위주는 PNG)
  · 용량      : 300KB 이하 권장 / 최대 5MB
  · 색상      : RGB · 배경 투명 금지
  · 애니메이션: GIF 가능 (3회 반복 이내 권장)

■ 함께 보내주실 것
  1. 배너 이미지 파일 (방식 A 는 PC용 · 모바일용 두 장)
  2. 클릭 시 이동할 URL
  3. 광고주명 (리포트 표기용)
  4. 게재 희망 기간

※ 게재 종료 후 노출수 · 클릭수 · CTR · PC/모바일 비중 리포트를 드립니다.
※ 클릭 링크에는 utm_source=bookwiki 파라미터가 자동으로 붙어,
   광고주님 쪽 애널리틱스에서도 북위키 유입을 바로 확인하실 수 있습니다.`;
