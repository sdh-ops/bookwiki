"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function ResetPasswordPage() {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [isSuccess, setIsSuccess] = useState(false);

    useEffect(() => {
        // 비밀번호 재설정 모드인지 확인 (해시 파라미터 체크)
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                // 세션이 없으면 링크가 유효하지 않거나 만료된 것임
                // 하지만 Supabase는 리셋 링크 클릭 시 자동으로 세션을 생성함
            }
        };
        checkSession();
    }, []);

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage("");

        if (password !== confirmPassword) {
            setMessage("비밀번호가 일치하지 않습니다.");
            setLoading(false);
            return;
        }

        if (password.length < 6) {
            setMessage("비밀번호는 6자 이상이어야 합니다.");
            setLoading(false);
            return;
        }

        const { error } = await supabase.auth.updateUser({
            password: password
        });

        if (error) {
            setMessage("비밀번호 변경 실패: " + error.message);
        } else {
            setMessage("비밀번호가 성공적으로 변경되었습니다. 잠시 후 로그인 페이지로 이동합니다.");
            setIsSuccess(true);
            setTimeout(() => {
                window.location.href = "/login";
            }, 2000);
        }
        setLoading(false);
    };

    return (
        <main className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <Link href="/" className="flex justify-center mb-6">
                    <h1 className="text-3xl font-bold tracking-tighter text-[#355E3B]">북위키</h1>
                </Link>
                <h2 className="text-center text-xl font-bold text-gray-900 tracking-tight">
                    비밀번호 재설정
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600">
                    새로운 비밀번호를 입력해주세요.
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100">
                    <form className="space-y-6" onSubmit={handleResetPassword}>
                        <div>
                            <label htmlFor="password" class="block text-sm font-medium text-gray-700">
                                새 비밀번호
                            </label>
                            <div className="mt-1">
                                <input
                                    id="password"
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#355E3B] focus:border-[#355E3B] sm:text-sm"
                                    placeholder="6자 이상 입력"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="confirmPassword" class="block text-sm font-medium text-gray-700">
                                새 비밀번호 확인
                            </label>
                            <div className="mt-1">
                                <input
                                    id="confirmPassword"
                                    type="password"
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#355E3B] focus:border-[#355E3B] sm:text-sm"
                                    placeholder="비밀번호 다시 입력"
                                />
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={loading || isSuccess}
                                className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#355E3B] hover:bg-[#2A4A2E] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#355E3B] ${loading || isSuccess ? "opacity-50 cursor-not-allowed" : ""}`}
                            >
                                {loading ? "처리 중..." : "비밀번호 변경하기"}
                            </button>
                        </div>
                    </form>

                    {message && (
                        <div className={`mt-4 p-3 rounded text-sm text-center ${
                            isSuccess ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                        }`}>
                            {message}
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
