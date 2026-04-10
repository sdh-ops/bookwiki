"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function PollWidget({ postId, pollOptions, user }) {
  const [hasVoted, setHasVoted] = useState(false);
  const [votesData, setVotesData] = useState([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // 세션 ID 가져오기 (회원: user.id, 비회원: 로컬스토리지 UUID)
  const getSessionId = () => {
    if (user?.id) return user.id;
    let visitorId = localStorage.getItem("bw_visitor_id");
    if (!visitorId) {
      visitorId = "guest_" + crypto.randomUUID();
      localStorage.setItem("bw_visitor_id", visitorId);
    }
    return visitorId;
  };

  useEffect(() => {
    if (!pollOptions || pollOptions.length === 0) {
      setLoading(false);
      return;
    }

    const fetchVotes = async () => {
      const sessionId = getSessionId();

      // 전체 투표 데이터 가져오기
      const { data, error } = await supabase
        .from("bw_votes")
        .select("option_id, session_id")
        .eq("post_id", postId);

      if (error) {
        console.error("투표 데이터 불러오기 에러:", error);
        setLoading(false);
        return;
      }

      setTotalVotes(data.length);

      // 내가 투표했는지 확인
      const myVote = data.find((v) => v.session_id === sessionId);
      if (myVote) {
        setHasVoted(true);
        setSelectedOption(myVote.option_id);
      }

      // 옵션별 투표수 집계
      const counts = {};
      data.forEach((v) => {
        counts[v.option_id] = (counts[v.option_id] || 0) + 1;
      });
      setVotesData(counts);
      setLoading(false);
    };

    fetchVotes();
  }, [postId, pollOptions, user]);

  const handleVote = async () => {
    if (selectedOption === null) return;
    setSubmitting(true);
    const sessionId = getSessionId();

    const { error } = await supabase.from("bw_votes").insert([
      {
        post_id: postId,
        option_id: selectedOption,
        session_id: sessionId,
      },
    ]);

    if (error) {
      // 혹시 중복 투표 체크 등에 걸린 경우
      alert("투표 실패: " + error.message);
      setSubmitting(false);
    } else {
      setHasVoted(true);
      setTotalVotes((prev) => prev + 1);
      setVotesData((prev) => ({
        ...prev,
        [selectedOption]: (prev[selectedOption] || 0) + 1,
      }));
      setSubmitting(false);
    }
  };

  if (loading || !pollOptions || pollOptions.length === 0) return null;

  return (
    <div className="my-8 p-6 bg-gray-50 border border-gray-200 rounded-lg shadow-sm">
      <h3 className="text-lg font-bold text-[#355E3B] mb-4">📊 투표</h3>

      <div className="space-y-3 mb-6">
        {pollOptions.map((opt) => {
          const count = votesData[opt.id] || 0;
          const percentage = totalVotes === 0 ? 0 : Math.round((count / totalVotes) * 100);

          return (
            <div key={opt.id} className="relative">
              {hasVoted ? (
                <div className="flex flex-col mb-2">
                  <div className="flex justify-between text-sm mb-1 z-10 mx-2 mt-2">
                    <span className={selectedOption === opt.id ? "font-bold text-[#355E3B]" : "text-gray-700"}>
                      {opt.text} {selectedOption === opt.id && "✓"}
                    </span>
                    <span className="text-gray-500 text-xs">
                      {count}표 ({percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-8 overflow-hidden relative">
                    <div
                      className={`h-full ${selectedOption === opt.id ? "bg-green-300" : "bg-gray-300"}`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              ) : (
                <label
                  className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedOption === opt.id ? "border-[#355E3B] bg-green-50" : "border-gray-300 bg-white hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="poll_option"
                    value={opt.id}
                    checked={selectedOption === opt.id}
                    onChange={() => setSelectedOption(opt.id)}
                    className="w-4 h-4 text-[#355E3B] border-gray-300 focus:ring-[#355E3B]"
                  />
                  <span className="ml-3 text-sm font-medium text-gray-700">{opt.text}</span>
                </label>
              )}
            </div>
          );
        })}
      </div>

      {!hasVoted ? (
        <button
          onClick={handleVote}
          disabled={selectedOption === null || submitting}
          className={`w-full py-2.5 rounded-lg font-bold text-white transition-colors ${
            selectedOption === null || submitting ? "bg-gray-400 cursor-not-allowed" : "bg-[#355E3B] hover:bg-[#2A4A2E]"
          }`}
        >
          {submitting ? "투표 중..." : "투표하기"}
        </button>
      ) : (
        <div className="text-center text-sm font-medium text-gray-500 mt-4">
          총 {totalVotes}명이 투표했습니다.
        </div>
      )}
    </div>
  );
}
