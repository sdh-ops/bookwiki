"use client";

import { useEffect, useState, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

// Board type to Korean name mapping
const boardTypeNames = {
    job: "구인구직",
    support: "지원사업",
    free: "톡톡",
    ai: "AI허브",
};

function MyPageContent() {
    const [user, setUser] = useState(null);
    const [posts, setPosts] = useState([]);
    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(true);
    const searchParams = useSearchParams();
    const router = useRouter();
    const currentTab = searchParams.get("tab") || "posts";

    // 비밀번호 변경 상태
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmNewPassword, setConfirmNewPassword] = useState("");
    const [passwordMessage, setPasswordMessage] = useState("");
    const [passwordLoading, setPasswordLoading] = useState(false);

    // 회원 탈퇴 상태
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [withdrawPassword, setWithdrawPassword] = useState("");
    const [withdrawConfirm, setWithdrawConfirm] = useState("");
    const [withdrawMessage, setWithdrawMessage] = useState("");
    const [withdrawLoading, setWithdrawLoading] = useState(false);

    // 닉네임 변경 상태
    const [showNicknameModal, setShowNicknameModal] = useState(false);
    const [newNickname, setNewNickname] = useState("");
    const [canChangeNickname, setCanChangeNickname] = useState(false);
    const [nicknameChangeDate, setNicknameChangeDate] = useState(null);
    const [nicknameMessage, setNicknameMessage] = useState("");
    const [nicknameLoading, setNicknameLoading] = useState(false);

    useEffect(() => {
        async function fetchData() {
            setLoading(true);

            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                alert("로그인이 필요합니다.");
                router.push("/login");
                return;
            }

            setUser(user);

            // Fetch user's posts
            const { data: postsData } = await supabase
                .from("bw_posts")
                .select("*")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false });

            if (postsData) setPosts(postsData);

            // Fetch user's comments with post info (by nickname)
            const nickname = user.user_metadata?.nickname;
            if (nickname) {
                const { data: commentsData } = await supabase
                    .from("bw_comments")
                    .select("*, bw_posts(id, title)")
                    .eq("author", nickname)
                    .order("created_at", { ascending: false });

                if (commentsData) setComments(commentsData);
            }

            // Check nickname change eligibility
            const { data: profileData } = await supabase
                .from("profiles")
                .select("nickname_updated_at")
                .eq("id", user.id)
                .maybeSingle();

            if (!profileData?.nickname_updated_at) {
                setCanChangeNickname(true);
            } else {
                const lastChange = new Date(profileData.nickname_updated_at);
                const now = new Date();
                const daysSince = (now - lastChange) / (1000 * 60 * 60 * 24);
                setCanChangeNickname(daysSince >= 30);
                setNicknameChangeDate(lastChange);
            }

            setLoading(false);
        }

        fetchData();
    }, [router]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = "/";
    };

    // 비밀번호 변경
    const handlePasswordChange = async () => {
        setPasswordMessage("");
        setPasswordLoading(true);

        if (!currentPassword) {
            setPasswordMessage("현재 비밀번호를 입력해주세요.");
            setPasswordLoading(false);
            return;
        }

        if (!newPassword || newPassword.length < 6) {
            setPasswordMessage("새 비밀번호는 6자 이상이어야 합니다.");
            setPasswordLoading(false);
            return;
        }

        if (newPassword !== confirmNewPassword) {
            setPasswordMessage("새 비밀번호가 일치하지 않습니다.");
            setPasswordLoading(false);
            return;
        }

        // 현재 비밀번호 확인
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: user.email,
            password: currentPassword,
        });

        if (signInError) {
            setPasswordMessage("현재 비밀번호가 올바르지 않습니다.");
            setPasswordLoading(false);
            return;
        }

        // 비밀번호 변경
        const { error } = await supabase.auth.updateUser({
            password: newPassword
        });

        if (error) {
            setPasswordMessage("비밀번호 변경 실패: " + error.message);
        } else {
            setPasswordMessage("비밀번호가 성공적으로 변경되었습니다.");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmNewPassword("");
            setTimeout(() => {
                setShowPasswordModal(false);
                setPasswordMessage("");
            }, 1500);
        }
        setPasswordLoading(false);
    };

    // 닉네임 변경
    const handleNicknameChange = async () => {
        setNicknameMessage("");
        setNicknameLoading(true);

        if (!newNickname || newNickname.trim().length < 2) {
            setNicknameMessage("닉네임은 2자 이상이어야 합니다.");
            setNicknameLoading(false);
            return;
        }

        if (newNickname.trim().length > 20) {
            setNicknameMessage("닉네임은 20자 이하여야 합니다.");
            setNicknameLoading(false);
            return;
        }

        if (!canChangeNickname) {
            setNicknameMessage("닉네임은 30일에 한 번만 변경할 수 있습니다.");
            setNicknameLoading(false);
            return;
        }

        const trimmedNickname = newNickname.trim();

        // Check if nickname is already taken
        const { data: existingProfile } = await supabase
            .from("profiles")
            .select("id")
            .eq("nickname", trimmedNickname)
            .neq("id", user.id)
            .maybeSingle();

        if (existingProfile) {
            setNicknameMessage("이미 사용 중인 닉네임입니다.");
            setNicknameLoading(false);
            return;
        }

        const oldNickname = user.user_metadata?.nickname;

        try {
            // Save nickname history
            await supabase.from("bw_nickname_history").insert({
                user_id: user.id,
                old_nickname: oldNickname,
                new_nickname: trimmedNickname
            });

            // Update profiles table
            await supabase
                .from("profiles")
                .update({
                    nickname: trimmedNickname,
                    nickname_updated_at: new Date().toISOString()
                })
                .eq("id", user.id);

            // Update auth metadata
            const { error } = await supabase.auth.updateUser({
                data: { nickname: trimmedNickname }
            });

            if (error) {
                setNicknameMessage("닉네임 변경 실패: " + error.message);
            } else {
                setNicknameMessage("닉네임이 성공적으로 변경되었습니다. 페이지를 새로고침합니다.");
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            }
        } catch (error) {
            console.error("Nickname change error:", error);
            setNicknameMessage("닉네임 변경 중 오류가 발생했습니다.");
        }

        setNicknameLoading(false);
    };

    // 회원 탈퇴
    const handleWithdraw = async () => {
        setWithdrawMessage("");
        setWithdrawLoading(true);

        if (!withdrawPassword) {
            setWithdrawMessage("비밀번호를 입력해주세요.");
            setWithdrawLoading(false);
            return;
        }

        if (withdrawConfirm !== "탈퇴합니다") {
            setWithdrawMessage("'탈퇴합니다'를 정확히 입력해주세요.");
            setWithdrawLoading(false);
            return;
        }

        // 비밀번호 확인
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: user.email,
            password: withdrawPassword,
        });

        if (signInError) {
            setWithdrawMessage("비밀번호가 올바르지 않습니다.");
            setWithdrawLoading(false);
            return;
        }

        try {
            const username = user.user_metadata?.username;

            // 1. bw_usernames에서 삭제
            if (username) {
                await supabase
                    .from("bw_usernames")
                    .delete()
                    .eq("username", username);
            }

            // 2. 사용자의 게시글에서 user_id 제거 (게시글은 유지, 작성자 표시는 유지)
            await supabase
                .from("bw_posts")
                .update({ user_id: null })
                .eq("user_id", user.id);

            // 3. 사용자의 댓글에서 user_id 제거
            await supabase
                .from("bw_comments")
                .update({ user_id: null })
                .eq("user_id", user.id);

            // 4. Supabase Auth에서 로그아웃
            await supabase.auth.signOut();

            alert("회원 탈퇴가 완료되었습니다. 이용해주셔서 감사합니다.");
            router.push("/");
        } catch (error) {
            console.error("Withdraw error:", error);
            setWithdrawMessage("탈퇴 처리 중 오류가 발생했습니다.");
        }

        setWithdrawLoading(false);
    };

    if (loading) return <div className="p-10 text-center">로딩 중...</div>;
    if (!user) return null;

    const nickname = user.user_metadata?.nickname || "사용자";
    const username = user.user_metadata?.username || "";

    return (
        <main className="min-h-screen bg-white">
            <header className="bg-[#355E3B] text-white py-3">
                <div className="max-w-4xl mx-auto px-4 flex items-center justify-between">
                    <div className="flex items-center">
                        <Link href="/" className="text-xl font-bold tracking-tighter">북위키</Link>
                        <span className="ml-4 text-sm font-medium opacity-80">내 활동</span>
                    </div>
                    <div className="flex items-center space-x-4">
                        <span className="text-xs text-white/70">{nickname}</span>
                        <button onClick={handleLogout} className="text-xs text-white/70 hover:text-white">로그아웃</button>
                    </div>
                </div>
            </header>

            <section className="max-w-4xl mx-auto px-4 py-8">
                {/* 계정 정보 카드 */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-8">
                    <h3 className="text-sm font-bold text-gray-700 mb-4">계정 정보</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-gray-500">아이디:</span>
                            <span className="ml-2 font-medium">{username}</span>
                        </div>
                        <div>
                            <span className="text-gray-500">닉네임:</span>
                            <span className="ml-2 font-medium">{nickname}</span>
                        </div>
                        <div>
                            <span className="text-gray-500">이메일:</span>
                            <span className="ml-2 font-medium">{user.email}</span>
                        </div>
                        <div>
                            <span className="text-gray-500">가입일:</span>
                            <span className="ml-2 font-medium">{new Date(user.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                    <div className="mt-6 flex flex-wrap gap-3">
                        <button
                            onClick={() => setShowNicknameModal(true)}
                            className="px-4 py-2 text-xs font-medium bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                            닉네임 변경 {!canChangeNickname && "(30일 후 가능)"}
                        </button>
                        <button
                            onClick={() => setShowPasswordModal(true)}
                            className="px-4 py-2 text-xs font-medium bg-[#355E3B] text-white rounded hover:bg-[#2A4A2E]"
                        >
                            비밀번호 변경
                        </button>
                        <button
                            onClick={() => setShowWithdrawModal(true)}
                            className="px-4 py-2 text-xs font-medium bg-white text-red-500 border border-red-300 rounded hover:bg-red-50"
                        >
                            회원 탈퇴
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 mb-6">
                    <button
                        onClick={() => router.push("/mypage")}
                        className={`px-6 py-3 text-sm font-medium border-b-2 -mb-px ${currentTab === "posts" ? "border-[#355E3B] text-[#355E3B]" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                    >
                        내가 쓴 글 ({posts.length})
                    </button>
                    <button
                        onClick={() => router.push("/mypage?tab=comments")}
                        className={`px-6 py-3 text-sm font-medium border-b-2 -mb-px ${currentTab === "comments" ? "border-[#355E3B] text-[#355E3B]" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                    >
                        내가 쓴 댓글 ({comments.length})
                    </button>
                </div>

                {/* Posts Tab */}
                {currentTab === "posts" && (
                    <div>
                        {posts.length === 0 ? (
                            <div className="py-20 text-center text-gray-400 text-sm">
                                작성한 글이 없습니다.
                            </div>
                        ) : (
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-500 border-b border-gray-200">
                                    <tr>
                                        <th className="px-2 py-2 font-medium">제목</th>
                                        <th className="px-2 py-2 font-medium w-24">게시판</th>
                                        <th className="px-2 py-2 font-medium w-24 text-center">날짜</th>
                                        <th className="px-2 py-2 font-medium w-16 text-center">조회</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {posts.map((post) => (
                                        <tr
                                            key={post.id}
                                            className="hover:bg-gray-50 cursor-pointer"
                                            onClick={() => router.push(`/post/${post.id}`)}
                                        >
                                            <td className="px-2 py-3 font-medium text-gray-800">
                                                {post.title}
                                                {post.comment_count > 0 && (
                                                    <span className="text-red-500 ml-1 text-[10px] font-bold">[{post.comment_count}]</span>
                                                )}
                                            </td>
                                            <td className="px-2 py-3 text-xs text-[#355E3B] font-bold">{boardTypeNames[post.board_type] || post.board_type}</td>
                                            <td className="px-2 py-3 text-xs text-gray-400 text-center">{new Date(post.created_at).toLocaleDateString()}</td>
                                            <td className="px-2 py-3 text-xs text-gray-400 text-center">{post.view_count}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {/* Comments Tab */}
                {currentTab === "comments" && (
                    <div>
                        {comments.length === 0 ? (
                            <div className="py-20 text-center text-gray-400 text-sm">
                                작성한 댓글이 없습니다.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {comments.map((comment) => (
                                    <div
                                        key={comment.id}
                                        className="border border-gray-200 rounded p-4 hover:bg-gray-50 cursor-pointer"
                                        onClick={() => router.push(`/post/${comment.post_id}`)}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-xs text-[#355E3B] font-bold">
                                                {comment.bw_posts?.title || "삭제된 게시글"}
                                            </span>
                                            <span className="text-[10px] text-gray-400">
                                                {new Date(comment.created_at).toLocaleString()}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-2">
                                            {comment.content}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </section>

            {/* 닉네임 변경 모달 */}
            {showNicknameModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-2xl">
                        <h4 className="text-lg font-bold mb-4">닉네임 변경</h4>
                        {!canChangeNickname && nicknameChangeDate && (
                            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                                <p className="text-xs text-yellow-700">
                                    마지막 변경: {nicknameChangeDate.toLocaleDateString()}<br/>
                                    다음 변경 가능일: {new Date(nicknameChangeDate.getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                                </p>
                            </div>
                        )}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">현재 닉네임</label>
                                <input
                                    type="text"
                                    value={nickname}
                                    disabled
                                    className="w-full px-3 py-2 border border-gray-200 rounded text-sm bg-gray-100 cursor-not-allowed"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">새 닉네임</label>
                                <input
                                    type="text"
                                    value={newNickname}
                                    onChange={(e) => setNewNickname(e.target.value)}
                                    disabled={!canChangeNickname}
                                    className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                    placeholder="새 닉네임 (2-20자)"
                                    maxLength={20}
                                />
                                <p className="mt-1 text-xs text-gray-500">* 닉네임은 30일에 한 번만 변경할 수 있습니다.</p>
                            </div>
                        </div>
                        {nicknameMessage && (
                            <div className={`mt-4 p-2 rounded text-xs text-center ${
                                nicknameMessage.includes("성공") ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                            }`}>
                                {nicknameMessage}
                            </div>
                        )}
                        <div className="flex space-x-2 mt-6">
                            <button
                                onClick={() => {
                                    setShowNicknameModal(false);
                                    setNicknameMessage("");
                                    setNewNickname("");
                                }}
                                className="flex-1 py-2 text-sm text-gray-500 hover:bg-gray-50 rounded border border-gray-200"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleNicknameChange}
                                disabled={nicknameLoading || !canChangeNickname}
                                className={`flex-1 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 ${(nicknameLoading || !canChangeNickname) ? "opacity-50 cursor-not-allowed" : ""}`}
                            >
                                {nicknameLoading ? "처리 중..." : "변경하기"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 비밀번호 변경 모달 */}
            {showPasswordModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-2xl">
                        <h4 className="text-lg font-bold mb-4">비밀번호 변경</h4>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">현재 비밀번호</label>
                                <input
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#355E3B]"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">새 비밀번호</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#355E3B]"
                                    placeholder="6자 이상"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">새 비밀번호 확인</label>
                                <input
                                    type="password"
                                    value={confirmNewPassword}
                                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#355E3B]"
                                />
                            </div>
                        </div>
                        {passwordMessage && (
                            <div className={`mt-4 p-2 rounded text-xs text-center ${
                                passwordMessage.includes("성공") ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                            }`}>
                                {passwordMessage}
                            </div>
                        )}
                        <div className="flex space-x-2 mt-6">
                            <button
                                onClick={() => {
                                    setShowPasswordModal(false);
                                    setPasswordMessage("");
                                    setCurrentPassword("");
                                    setNewPassword("");
                                    setConfirmNewPassword("");
                                }}
                                className="flex-1 py-2 text-sm text-gray-500 hover:bg-gray-50 rounded border border-gray-200"
                            >
                                취소
                            </button>
                            <button
                                onClick={handlePasswordChange}
                                disabled={passwordLoading}
                                className={`flex-1 py-2 text-sm bg-[#355E3B] text-white rounded hover:bg-[#2A4A2E] ${passwordLoading ? "opacity-50" : ""}`}
                            >
                                {passwordLoading ? "처리 중..." : "변경하기"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 회원 탈퇴 모달 */}
            {showWithdrawModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-2xl">
                        <h4 className="text-lg font-bold text-red-600 mb-4">회원 탈퇴</h4>
                        <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
                            <p className="text-xs text-red-600">
                                탈퇴 시 계정 정보가 삭제됩니다.<br/>
                                작성하신 게시글과 댓글은 유지되지만, 회원 정보와의 연결이 해제됩니다.<br/>
                                이 작업은 되돌릴 수 없습니다.
                            </p>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호 확인</label>
                                <input
                                    type="password"
                                    value={withdrawPassword}
                                    onChange={(e) => setWithdrawPassword(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-red-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    확인을 위해 <span className="text-red-600 font-bold">'탈퇴합니다'</span>를 입력하세요
                                </label>
                                <input
                                    type="text"
                                    value={withdrawConfirm}
                                    onChange={(e) => setWithdrawConfirm(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-red-500"
                                    placeholder="탈퇴합니다"
                                />
                            </div>
                        </div>
                        {withdrawMessage && (
                            <div className="mt-4 p-2 rounded text-xs text-center bg-red-50 text-red-600">
                                {withdrawMessage}
                            </div>
                        )}
                        <div className="flex space-x-2 mt-6">
                            <button
                                onClick={() => {
                                    setShowWithdrawModal(false);
                                    setWithdrawMessage("");
                                    setWithdrawPassword("");
                                    setWithdrawConfirm("");
                                }}
                                className="flex-1 py-2 text-sm text-gray-500 hover:bg-gray-50 rounded border border-gray-200"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleWithdraw}
                                disabled={withdrawLoading}
                                className={`flex-1 py-2 text-sm bg-red-500 text-white rounded hover:bg-red-600 ${withdrawLoading ? "opacity-50" : ""}`}
                            >
                                {withdrawLoading ? "처리 중..." : "탈퇴하기"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <footer className="mt-10 border-t border-gray-200 bg-gray-50 py-10">
                <div className="max-w-4xl mx-auto px-4 text-center text-xs text-gray-400">
                    <p>© 2026 북위키 (Book-Wiki). All rights reserved.</p>
                </div>
            </footer>
        </main>
    );
}

export default function MyPage() {
    return (
        <Suspense fallback={<div className="p-10 text-center">로딩 중...</div>}>
            <MyPageContent />
        </Suspense>
    );
}
