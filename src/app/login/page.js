"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage("");

        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo: window.location.origin,
            },
        });

        if (error) {
            setMessage("에러가 발생했습니다: " + error.message);
        } else {
            setMessage("이메일을 확인해주세요! 로그인 링크를 보냈습니다.");
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
                    이메일로 간편 로그인
                </h2>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100">
                    <form className="space-y-6" onSubmit={handleLogin}>
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
                            <button
                                type="submit"
                                disabled={loading}
                                className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#4a6a8a] hover:bg-[#3a5a7a] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#4a6a8a] ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
                            >
                                {loading ? "보내는 중..." : "로그인 링크 받기"}
                            </button>
                        </div>
                    </form>

                    {message && (
                        <div className={`mt-4 p-3 rounded text-sm text-center ${message.includes("에러") ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"}`}>
                            {message}
                        </div>
                    )}

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
