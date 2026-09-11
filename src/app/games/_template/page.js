import Game from "./Game";

// 이 폴더를 복사해 src/app/games/<영문-소문자-이름>/ 으로 만들면 /games/<이름> 주소가 생긴다.
// (_ 로 시작하는 이 템플릿 폴더 자체는 주소가 없다.)
// 제목·설명은 카톡 공유 미리보기와 브라우저 탭에 쓰인다 — 게임에 맞게 바꾼다.
export const metadata = {
  title: "출판 용어 퀴즈",
  description: "판권면부터 띠지까지, 출판 현장에서 쓰는 말을 얼마나 알고 있나요?",
};

export default function GamePage() {
  return (
    <main className="min-h-[70vh] bg-white">
      <div className="max-w-xl mx-auto px-4 py-8">
        <Game />
      </div>
    </main>
  );
}
