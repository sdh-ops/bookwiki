"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";

/**
 * 게임 템플릿 — 출판 용어 퀴즈.
 *
 * 새 게임을 만들 때 이 파일을 통째로 바꿔도 된다. 지켜야 할 것만 남겨 둔다.
 * - DB 를 쓰지 않는다. 최고 점수는 localStorage 에 (막힌 브라우저가 있으니 try/catch).
 * - 알림이 필요하면 alert 대신 `import { toast } from "@/lib/notify"`.
 * - 모바일 폭 375px, 누르는 칸 44px 이상, 키보드로도 되게.
 */

// ⬇ 이 키 이름을 게임마다 다르게 바꾼다 (다른 게임과 기록이 섞이지 않게)
const BEST_KEY = "bw_game_template_best";

const QUESTIONS = [
  {
    q: "책의 앞이나 뒤에 발행일·발행처·ISBN 을 모아 적는 면은?",
    options: ["판권면", "속표지", "면지", "띠지"],
    answer: 0,
  },
  {
    q: "표지를 감싸는 좁은 종이로, 추천사나 광고 문구를 넣는 것은?",
    options: ["책날개", "띠지", "커버", "간지"],
    answer: 1,
  },
  {
    q: "인쇄 전에 오탈자를 잡으려고 뽑아 보는 원고는?",
    options: ["가제본", "견본", "교정지", "필름"],
    answer: 2,
  },
  {
    q: "우리나라 책의 ISBN(13자리)은 어떤 숫자로 시작하나요?",
    options: ["977 또는 976", "979 또는 978", "880 또는 881", "123 또는 456"],
    answer: 1,
  },
];

// ─── 최고 점수 (localStorage) ───────────────────────────
function readBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest(score) {
  try {
    if (score > readBest()) localStorage.setItem(BEST_KEY, String(score));
  } catch {
    // 저장이 막혀도 게임은 계속된다
  }
}

// 서버 그림에선 0, 브라우저에선 저장된 값 — 하이드레이션이 어긋나지 않는다(렌더마다 다시 읽는다)
const noSubscribe = () => () => {};
function useBestScore() {
  return useSyncExternalStore(noSubscribe, readBest, () => 0);
}

export default function Game() {
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState(null); // 이번 문제에서 고른 보기
  const [finished, setFinished] = useState(false);
  const best = useBestScore();

  const current = QUESTIONS[index];
  const isCorrect = picked !== null && picked === current.answer;

  const choose = (optionIndex) => {
    if (picked !== null) return;
    setPicked(optionIndex);
    if (optionIndex === current.answer) setScore((s) => s + 1);
  };

  const next = () => {
    if (index + 1 < QUESTIONS.length) {
      setIndex(index + 1);
      setPicked(null);
      return;
    }
    saveBest(score);
    setFinished(true);
  };

  const restart = () => {
    setIndex(0);
    setScore(0);
    setPicked(null);
    setFinished(false);
  };

  if (finished) {
    return (
      <section className="text-center py-10">
        <p className="text-5xl mb-4" aria-hidden="true">📚</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {QUESTIONS.length}문제 중 {score}문제 맞혔어요
        </h1>
        <p className="text-sm text-gray-600 mb-8">내 최고 기록 {Math.max(best, score)}점</p>
        <div className="flex justify-center gap-2">
          <button type="button" onClick={restart} className="min-h-11 px-6 rounded-lg bg-[#355E3B] text-white text-sm font-bold hover:bg-[#2A4A2E]">
            다시 하기
          </button>
          <Link href="/" className="inline-flex items-center min-h-11 px-6 rounded-lg border border-gray-300 text-sm font-bold text-gray-700 hover:bg-gray-50">
            북위키 홈
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="quiz-question">
      <div className="flex items-center justify-between mb-4 text-sm text-gray-500">
        <span>
          {index + 1} / {QUESTIONS.length}
        </span>
        <span>
          점수 {score} · 최고 {best}
        </span>
      </div>

      <h1 id="quiz-question" className="text-lg md:text-xl font-bold text-gray-900 leading-snug mb-5">
        {current.q}
      </h1>

      <div className="grid gap-2">
        {current.options.map((option, i) => {
          const chosen = picked === i;
          const reveal = picked !== null && i === current.answer;
          return (
            <button
              key={option}
              type="button"
              onClick={() => choose(i)}
              disabled={picked !== null}
              aria-pressed={chosen}
              className={`min-h-12 px-4 rounded-lg border text-left text-base transition ${
                reveal
                  ? "bg-green-50 border-green-500 text-green-800 font-bold"
                  : chosen
                  ? "bg-red-50 border-red-400 text-red-700"
                  : "bg-white border-gray-200 hover:border-[#355E3B] hover:bg-gray-50"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>

      {picked !== null && (
        <div className="mt-5 flex items-center justify-between gap-3" role="status">
          <p className={`text-sm font-bold ${isCorrect ? "text-green-700" : "text-red-600"}`}>
            {isCorrect ? "정답입니다!" : `아쉬워요. 정답은 「${current.options[current.answer]}」`}
          </p>
          <button type="button" onClick={next} className="shrink-0 min-h-11 px-5 rounded-lg bg-[#355E3B] text-white text-sm font-bold hover:bg-[#2A4A2E]">
            {index + 1 < QUESTIONS.length ? "다음 문제" : "결과 보기"}
          </button>
        </div>
      )}
    </section>
  );
}
