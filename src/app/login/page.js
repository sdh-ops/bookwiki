"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function LoginPage() {
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage("");

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setMessage("로그인 실패: " + error.message);
        } else {
            window.location.href = "/";
        }
        setLoading(false);
    };

    const handleSignUp = async (e) => {
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

        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: window.location.origin,
            },
        });

        if (error) {
            setMessage("회원가입 실패: " + error.message);
        } else {
            setMessage("회원가입 완료! 이메일을 확인하여 계정을 인증해주세요.");
        }
        setLoading(false);
    };

    return (
        <main className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <Link href="/" className="flex justify-center mb-6">
                    <h1 className="text-3xl font-bold tracking-tighter text-[#4a6a8a]">북위키</h1>
                </Link>
                <h2 className="text-center text-xl font-bold text-gray-900 tracking-tight">
                    {isSignUp ? "회원가입" : "로그인"}
                </h2>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100">
                    <form className="space-y-6" onSubmit={isSignUp ? handleSignUp : handleLogin}>
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                                이메일 주소
                            </label>
                            <div className="mt-1">
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#4a6a8a] focus:border-[#4a6a8a] sm:text-sm"
                                    placeholder="name@example.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                                비밀번호
                            </label>
                            <div className="mt-1">
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete={isSignUp ? "new-password" : "current-password"}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#4a6a8a] focus:border-[#4a6a8a] sm:text-sm"
                                    placeholder="비밀번호를 입력하세요"
                                />
                            </div>
                        </div>

                        {isSignUp && (
                            <div>
                                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                                    비밀번호 확인
                                </label>
                                <div className="mt-1">
                                    <input
                                        id="confirmPassword"
                                        name="confirmPassword"
                                        type="password"
                                        autoComplete="new-password"
                                        required
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#4a6a8a] focus:border-[#4a6a8a] sm:text-sm"
                                        placeholder="비밀번호를 다시 입력하세요"
                                    />
                                </div>
                            </div>
                        )}

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#4a6a8a] hover:bg-[#3a5a7a] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#4a6a8a] ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
                            >
                                {loading ? "처리 중..." : (isSignUp ? "회원가입" : "로그인")}
                            </button>
                        </div>
                    </form>

                    {message && (
                        <div className={`mt-4 p-3 rounded text-sm text-center ${message.includes("실패") || message.includes("일치하지") || message.includes("이상") ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"}`}>
                            {message}
                        </div>
                    )}

                    <div className="mt-6">
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-300" />
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-white text-gray-500">
                                    {isSignUp ? "이미 계정이 있으신가요?" : "계정이 없으신가요?"}
                                </span>
                            </div>
                        </div>

                        <div className="mt-4">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsSignUp(!isSignUp);
                                    setMessage("");
                                    setPassword("");
                                    setConfirmPassword("");
                                }}
                                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#4a6a8a]"
                            >
                                {isSignUp ? "로그인하기" : "회원가입하기"}
                            </button>
                        </div>
                    </div>

                    <div className="mt-6 text-center">
                        <Link href="/" className="text-xs text-gray-400 hover:text-[#4a6a8a]">
                            메인으로 돌아가기
                        </Link>
                    </div>
                </div>
            </div>
        </main>
    );
}
