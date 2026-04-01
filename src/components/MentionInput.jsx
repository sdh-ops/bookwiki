"use client";

import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";

/**
 * MentionInput: @mention 자동완성 기능이 있는 textarea
 *
 * Props:
 * - value: 입력값
 * - onChange: 값 변경 핸들러
 * - placeholder: placeholder 텍스트
 * - className: CSS 클래스
 * - postId: 게시글 ID (해당 게시글의 댓글 작성자 조회)
 */
export default function MentionInput({ value, onChange, placeholder, className, postId }) {
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [mentionStart, setMentionStart] = useState(-1);
    const textareaRef = useRef(null);

    // @ 입력 감지 및 자동완성 목록 표시
    useEffect(() => {
        const detectMention = async () => {
            const cursorPos = textareaRef.current?.selectionStart || 0;
            const textBeforeCursor = value.substring(0, cursorPos);
            const lastAtIndex = textBeforeCursor.lastIndexOf('@');

            if (lastAtIndex !== -1) {
                const searchTerm = textBeforeCursor.substring(lastAtIndex + 1);

                // 공백이나 개행이 있으면 mention 종료
                if (searchTerm.includes(' ') || searchTerm.includes('\n')) {
                    setShowSuggestions(false);
                    return;
                }

                setMentionStart(lastAtIndex);

                // 해당 게시글의 댓글 작성자 조회
                const { data: comments } = await supabase
                    .from('bw_comments')
                    .select('author, user_id')
                    .eq('post_id', postId)
                    .eq('is_deleted', false); // 삭제되지 않은 댓글만

                if (comments) {
                    // 중복 제거
                    const uniqueAuthors = [...new Map(comments.map(c => [c.author, c])).values()];

                    // 검색어로 필터링
                    const filtered = uniqueAuthors.filter(c =>
                        c.author.toLowerCase().includes(searchTerm.toLowerCase())
                    ).slice(0, 5);

                    setSuggestions(filtered);
                    setShowSuggestions(filtered.length > 0);
                    setSelectedIndex(0);
                }
            } else {
                setShowSuggestions(false);
            }
        };

        detectMention();
    }, [value, postId]);

    // 자동완성 선택
    const selectSuggestion = (author) => {
        const before = value.substring(0, mentionStart);
        const after = value.substring(textareaRef.current.selectionStart);
        const newValue = `${before}@${author} ${after}`;

        onChange(newValue);
        setShowSuggestions(false);

        // 커서 위치 조정
        setTimeout(() => {
            const newPos = mentionStart + author.length + 2; // @ + author + space
            textareaRef.current.setSelectionRange(newPos, newPos);
            textareaRef.current.focus();
        }, 0);
    };

    // 키보드 네비게이션
    const handleKeyDown = (e) => {
        if (!showSuggestions) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex((prev) => (prev + 1) % suggestions.length);
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
                break;
            case 'Enter':
                if (suggestions[selectedIndex]) {
                    e.preventDefault();
                    selectSuggestion(suggestions[selectedIndex].author);
                }
                break;
            case 'Escape':
                setShowSuggestions(false);
                break;
        }
    };

    return (
        <div className="relative">
            <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className={className}
            />

            {showSuggestions && (
                <div className="absolute z-10 bg-white border border-gray-200 rounded shadow-lg mt-1 max-h-40 overflow-y-auto">
                    {suggestions.map((suggestion, idx) => (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => selectSuggestion(suggestion.author)}
                            className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${idx === selectedIndex ? 'bg-gray-100' : ''
                                }`}
                        >
                            <span className="font-medium text-gray-800">{suggestion.author}</span>
                            <span className="ml-2 text-xs text-green-500">✓</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
