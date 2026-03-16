"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

// 닉네임 금지 단어 목록
const BANNED_NICKNAMES = ["bookwiki", "북위키", "북위커", "양화대교", "방장", "운영자", "관리자", "admin", "administrator"];

export default function LoginPage() {
    const [isSignUp, setIsSignUp] = useState(false);
    const [isFindAccount, setIsFindAccount] = useState(false); // 아이디/비밀번호 찾기 모드
    const [findType, setFindType] = useState("id"); // id or password
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [nickname, setNickname] = useState("");
    const [nicknameAvailable, setNicknameAvailable] = useState(null);
    const [usernameAvailable, setUsernameAvailable] = useState(null);
    const [emailAvailable, setEmailAvailable] = useState(null);
    const [checkingNickname, setCheckingNickname] = useState(false);
    const [checkingUsername, setCheckingUsername] = useState(false);
    const [checkingEmail, setCheckingEmail] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    // 닉네임 금지 단어 체크
    const containsBannedWord = (text) => {
        const lowerText = text.toLowerCase();
        return BANNED_NICKNAMES.some(word => lowerText.includes(word.toLowerCase()));
    };

    const checkNickname = async () => {
        if (!nickname || nickname.length < 2) {
            setMessage("닉네임은 2자 이상이어야 합니다.");
            setNicknameAvailable(false);
            return;
        }

        // 금지 단어 체크
        if (containsBannedWord(nickname)) {
            setMessage("사용할 수 없는 닉네임입니다. (금지 단어 포함)");
            setNicknameAvailable(false);
            return;
        }

        setCheckingNickname(true);

        const { data: existingPosts } = await supabase
            .from("bw_posts")
            .select("author")
            .eq("author", nickname)
            .limit(1);

        if (existingPosts && existingPosts.length > 0) {
            setNicknameAvailable(false);
            setMessage("이미 사용 중인 닉네임입니다.");
        } else {
            setNicknameAvailable(true);
            setMessage("사용 가능한 닉네임입니다.");
        }
        setCheckingNickname(false);
    };

    const checkUsername = async () => {
        if (!username || username.length < 4) {
            setMessage("아이디는 4자 이상이어야 합니다.");
            setUsernameAvailable(false);
            return;
        }

        // 영문자, 숫자, 언더스코어만 허용
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            setMessage("아이디는 영문, 숫자, 언더스코어(_)만 사용 가능합니다.");
            setUsernameAvailable(false);
            return;
        }

        setCheckingUsername(true);

        const { data: existing } = await supabase
            .from("bw_usernames")
            .select("username")
            .eq("username", username.toLowerCase())
            .limit(1);

        if (existing && existing.length > 0) {
            setUsernameAvailable(false);
            setMessage("이미 사용 중인 아이디입니다.");
        } else {
            setUsernameAvailable(true);
            setMessage("사용 가능한 아이디입니다.");
        }
        setCheckingUsername(false);
    };

    // 이메일 중복 체크
    const checkEmail = async () => {
        if (!email || !email.includes("@")) {
            setMessage("올바른 이메일 형식이 아닙니다.");
            setEmailAvailable(false);
            return;
        }

        setCheckingEmail(true);

        const { data: existing } = await supabase
            .from("bw_usernames")
            .select("email")
            .eq("email", email.toLowerCase())
            .limit(1);

        if (existing && existing.length > 0) {
            setEmailAvailable(false);
            setMessage("이미 가입된 이메일입니다. 아이디 찾기를 이용해주세요.");
        } else {
            setEmailAvailable(true);
            setMessage("사용 가능한 이메일입니다.");
        }
        setCheckingEmail(false);
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage("");

        // 아이디로 이메일 조회
        const { data: userData, error: lookupError } = await supabase
            .from("bw_usernames")
            .select("email")
            .eq("username", username.toLowerCase())
            .single();

        if (lookupError || !userData) {
            setMessage("존재하지 않는 아이디입니다.");
            setLoading(false);
            return;
        }

        // 이메일로 로그인
        const { error } = await supabase.auth.signInWithPassword({
            email: userData.email,
            password,
        });

        if (error) {
            setMessage("로그인 실패: 비밀번호를 확인해주세요.");
        } else {
            window.location.href = "/";
        }
        setLoading(false);
    };

    const handleSignUp = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage("");

        if (!username || username.length < 4) {
            setMessage("아이디는 4자 이상이어야 합니다.");
            setLoading(false);
            return;
        }

        if (usernameAvailable !== true) {
            setMessage("아이디 중복확인을 해주세요.");
            setLoading(false);
            return;
        }

        if (!nickname || nickname.length < 2) {
            setMessage("닉네임은 2자 이상이어야 합니다.");
            setLoading(false);
            return;
        }

        // 닉네임 금지 단어 최종 체크
        if (containsBannedWord(nickname)) {
            setMessage("사용할 수 없는 닉네임입니다. (금지 단어 포함)");
            setLoading(false);
            return;
        }

        if (nicknameAvailable !== true) {
            setMessage("닉네임 중복확인을 해주세요.");
            setLoading(false);
            return;
        }

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

        // 이메일 중복 최종 체크
        const { data: existingEmail } = await supabase
            .from("bw_usernames")
            .select("email")
            .eq("email", email.toLowerCase())
            .limit(1);

        if (existingEmail && existingEmail.length > 0) {
            setMessage("이미 가입된 이메일입니다. 1개의 이메일로 1개의 계정만 가입 가능합니다.");
            setLoading(false);
            return;
        }

        // 회원가입
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    nickname: nickname,
                    username: username.toLowerCase(),
                }
            },
        });

        if (error) {
            // 상세 에러 메시지
            if (error.message.includes("already registered")) {
                setMessage("이미 가입된 이메일입니다.");
            } else if (error.message.includes("invalid")) {
                setMessage("유효하지 않은 이메일 형식입니다.");
            } else {
                setMessage("회원가입 실패: " + error.message);
            }
            setLoading(false);
            return;
        }

        if (data?.user) {
            // 아이디-이메일 매핑 저장
            const { error: usernameError } = await supabase
                .from("bw_usernames")
                .insert([{
                    username: username.toLowerCase(),
                    email: email.toLowerCase()
                }]);

            if (usernameError) {
                console.error("Username mapping error:", usernameError);
            }

            // 회원가입 성공 시 바로 홈으로 이동
            window.location.href = "/";
        }
        setLoading(false);
    };

    // 아이디 찾기
    const handleFindId = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage("");

        const { data, error } = await supabase
            .from("bw_usernames")
            .select("username")
            .eq("email", email.toLowerCase())
            .single();

        if (error || !data) {
            setMessage("해당 이메일로 가입된 계정이 없습니다.");
        } else {
            setMessage(`찾은 아이디: ${data.username}`);
        }
        setLoading(false);
    };

    // 비밀번호 재설정 이메일 발송
    const handleResetPassword = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage("");

        // 먼저 아이디로 이메일 조회
        const { data: userData, error: lookupError } = await supabase
            .from("bw_usernames")
            .select("email")
            .eq("username", username.toLowerCase())
            .single();

        if (lookupError || !userData) {
            setMessage("존재하지 않는 아이디입니다.");
            setLoading(false);
            return;
        }

        // 비밀번호 재설정 이메일 발송
        const { error } = await supabase.auth.resetPasswordForEmail(userData.email, {
            redirectTo: `${window.location.origin}/reset-password`,
        });

        if (error) {
            setMessage("이메일 발송 실패: " + error.message);
        } else {
            setMessage(`비밀번호 재설정 링크가 ${userData.email}로 발송되었습니다. 이메일을 확인해주세요.`);
        }
        setLoading(false);
    };

    const resetForm = () => {
        setMessage("");
        setPassword("");
        setConfirmPassword("");
        setNickname("");
        setUsername("");
        setEmail("");
        setNicknameAvailable(null);
        setUsernameAvailable(null);
        setEmailAvailable(null);
    };

    // 아이디/비밀번호 찾기 UI
    if (isFindAccount) {
        return (
            <main className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-6 lg:px-8">
                <div className="sm:mx-auto sm:w-full sm:max-w-md">
                    <Link href="/" className="flex justify-center mb-6">
                        <h1 className="text-3xl font-bold tracking-tighter text-[#355E3B]">북위키</h1>
                    </Link>
                    <h2 className="text-center text-xl font-bold text-gray-900 tracking-tight">
                        {findType === "id" ? "아이디 찾기" : "비밀번호 찾기"}
                    </h2>
                </div>

                <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                    <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100">
                        {/* 탭 */}
                        <div className="flex mb-6 border-b border-gray-200">
                            <button
                                type="button"
                                onClick={() => { setFindType("id"); setMessage(""); }}
                                className={`flex-1 py-2 text-sm font-medium border-b-2 -mb-px ${findType === "id" ? "border-[#355E3B] text-[#355E3B]" : "border-transparent text-gray-500"}`}
                            >
                                아이디 찾기
                            </button>
                            <button
                                type="button"
                                onClick={() => { setFindType("password"); setMessage(""); }}
                                className={`flex-1 py-2 text-sm font-medium border-b-2 -mb-px ${findType === "password" ? "border-[#355E3B] text-[#355E3B]" : "border-transparent text-gray-500"}`}
                            >
                                비밀번호 찾기
                            </button>
                        </div>

                        <form className="space-y-6" onSubmit={findType === "id" ? handleFindId : handleResetPassword}>
                            {findType === "id" ? (
                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                                        가입 시 사용한 이메일
                                    </label>
                                    <div className="mt-1">
                                        <input
                                            id="email"
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#355E3B] focus:border-[#355E3B] sm:text-sm"
                                            placeholder="name@example.com"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                                        아이디
                                    </label>
                                    <div className="mt-1">
                                        <input
                                            id="username"
                                            type="text"
                                            required
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#355E3B] focus:border-[#355E3B] sm:text-sm"
                                            placeholder="가입한 아이디 입력"
                                        />
                                    </div>
                                    <p className="mt-1 text-xs text-gray-500">입력한 아이디의 이메일로 비밀번호 재설정 링크가 발송됩니다.</p>
                                </div>
                            )}

                            <div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#355E3B] hover:bg-[#2A4A2E] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#355E3B] ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
                                >
                                    {loading ? "처리 중..." : (findType === "id" ? "아이디 찾기" : "비밀번호 재설정 이메일 발송")}
                                </button>
                            </div>
                        </form>

                        {message && (
                            <div className={`mt-4 p-3 rounded text-sm text-center ${
                                message.includes("실패") || message.includes("없습니다") || message.includes("존재하지")
                                    ? "bg-red-50 text-red-600"
                                    : "bg-green-50 text-green-600"
                            }`}>
                                {message}
                            </div>
                        )}

                        <div className="mt-6">
                            <button
                                type="button"
                                onClick={() => { setIsFindAccount(false); resetForm(); }}
                                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#355E3B]"
                            >
                                로그인으로 돌아가기
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <Link href="/" className="flex justify-center mb-6">
                    <h1 className="text-3xl font-bold tracking-tighter text-[#355E3B]">북위키</h1>
                </Link>
                <h2 className="text-center text-xl font-bold text-gray-900 tracking-tight">
                    {isSignUp ? "회원가입" : "로그인"}
                </h2>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100">
                    <form className="space-y-6" onSubmit={isSignUp ? handleSignUp : handleLogin}>
                        {/* 아이디 */}
                        <div>
                            <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                                아이디 <span className="text-red-500">*</span>
                            </label>
                            <div className="mt-1 flex space-x-2">
                                <input
                                    id="username"
                                    name="username"
                                    type="text"
                                    required
                                    value={username}
                                    onChange={(e) => {
                                        setUsername(e.target.value);
                                        setUsernameAvailable(null);
                                    }}
                                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#355E3B] focus:border-[#355E3B] sm:text-sm"
                                    placeholder="영문, 숫자 4자 이상"
                                />
                                {isSignUp && (
                                    <button
                                        type="button"
                                        onClick={checkUsername}
                                        disabled={checkingUsername || !username}
                                        className={`px-3 py-2 text-xs font-medium rounded-md whitespace-nowrap ${
                                            usernameAvailable === true
                                                ? "bg-green-500 text-white"
                                                : usernameAvailable === false
                                                    ? "bg-red-500 text-white"
                                                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                                        } ${checkingUsername ? "opacity-50" : ""}`}
                                    >
                                        {checkingUsername ? "확인중..." : usernameAvailable === true ? "사용가능" : usernameAvailable === false ? "사용불가" : "중복확인"}
                                    </button>
                                )}
                            </div>
                        </div>

                        {isSignUp && (
                            <>
                                {/* 닉네임 */}
                                <div>
                                    <label htmlFor="nickname" className="block text-sm font-medium text-gray-700">
                                        닉네임 <span className="text-red-500">*</span>
                                    </label>
                                    <div className="mt-1 flex space-x-2">
                                        <input
                                            id="nickname"
                                            name="nickname"
                                            type="text"
                                            required
                                            value={nickname}
                                            onChange={(e) => {
                                                setNickname(e.target.value);
                                                setNicknameAvailable(null);
                                            }}
                                            className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#355E3B] focus:border-[#355E3B] sm:text-sm"
                                            placeholder="사이트에서 표시될 이름"
                                        />
                                        <button
                                            type="button"
                                            onClick={checkNickname}
                                            disabled={checkingNickname || !nickname}
                                            className={`px-3 py-2 text-xs font-medium rounded-md whitespace-nowrap ${
                                                nicknameAvailable === true
                                                    ? "bg-green-500 text-white"
                                                    : nicknameAvailable === false
                                                        ? "bg-red-500 text-white"
                                                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                                            } ${checkingNickname ? "opacity-50" : ""}`}
                                        >
                                            {checkingNickname ? "확인중..." : nicknameAvailable === true ? "사용가능" : nicknameAvailable === false ? "사용불가" : "중복확인"}
                                        </button>
                                    </div>
                                    <p className="mt-1 text-xs text-gray-500">* 게시글/댓글에 표시되는 이름입니다.</p>
                                </div>

                                {/* 이메일 */}
                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                                        이메일 <span className="text-red-500">*</span>
                                    </label>
                                    <div className="mt-1 flex space-x-2">
                                        <input
                                            id="email"
                                            name="email"
                                            type="email"
                                            autoComplete="email"
                                            required
                                            value={email}
                                            onChange={(e) => {
                                                setEmail(e.target.value);
                                                setEmailAvailable(null);
                                            }}
                                            className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#355E3B] focus:border-[#355E3B] sm:text-sm"
                                            placeholder="name@example.com"
                                        />
                                        <button
                                            type="button"
                                            onClick={checkEmail}
                                            disabled={checkingEmail || !email}
                                            className={`px-3 py-2 text-xs font-medium rounded-md whitespace-nowrap ${
                                                emailAvailable === true
                                                    ? "bg-green-500 text-white"
                                                    : emailAvailable === false
                                                        ? "bg-red-500 text-white"
                                                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                                            } ${checkingEmail ? "opacity-50" : ""}`}
                                        >
                                            {checkingEmail ? "확인중..." : emailAvailable === true ? "사용가능" : emailAvailable === false ? "사용불가" : "중복확인"}
                                        </button>
                                    </div>
                                    <p className="mt-1 text-xs text-gray-500">* 1개의 이메일로 1개의 계정만 가입 가능합니다. (비밀번호 찾기에 사용)</p>
                                </div>
                            </>
                        )}

                        {/* 비밀번호 */}
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
                                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#355E3B] focus:border-[#355E3B] sm:text-sm"
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
                                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#355E3B] focus:border-[#355E3B] sm:text-sm"
                                        placeholder="비밀번호를 다시 입력하세요"
                                    />
                                </div>
                            </div>
                        )}

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#355E3B] hover:bg-[#2A4A2E] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#355E3B] ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
                            >
                                {loading ? "처리 중..." : (isSignUp ? "회원가입" : "로그인")}
                            </button>
                        </div>
                    </form>

                    {message && (
                        <div className={`mt-4 p-3 rounded text-sm text-center ${
                            message.includes("실패") || message.includes("일치하지") || message.includes("이상") || message.includes("이미") || message.includes("중복") || message.includes("존재하지") || message.includes("확인") || message.includes("불가") || message.includes("금지")
                                ? "bg-red-50 text-red-600"
                                : message.includes("사용 가능") || message.includes("사용가능")
                                    ? "bg-green-50 text-green-600"
                                    : "bg-blue-50 text-blue-600"
                        }`}>
                            {message}
                        </div>
                    )}

                    {/* 아이디/비밀번호 찾기 */}
                    {!isSignUp && (
                        <div className="mt-4 text-center">
                            <button
                                type="button"
                                onClick={() => { setIsFindAccount(true); resetForm(); }}
                                className="text-xs text-gray-500 hover:text-[#355E3B] underline"
                            >
                                아이디/비밀번호 찾기
                            </button>
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
                                    resetForm();
                                }}
                                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#355E3B]"
                            >
                                {isSignUp ? "로그인하기" : "회원가입하기"}
                            </button>
                        </div>
                    </div>

                    <div className="mt-6 text-center">
                        <Link href="/" className="text-xs text-gray-400 hover:text-[#355E3B]">
                            메인으로 돌아가기
                        </Link>
                    </div>
                </div>
            </div>
        </main>
    );
}
