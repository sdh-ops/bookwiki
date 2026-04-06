"use client";

import { useState, useRef } from "react";

export default function EditorToolbar({ editor, onImageUpload }) {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [showImageInput, setShowImageInput] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageFileRef = useRef(null);

  if (!editor) {
    return null;
  }

  const addLink = () => {
    if (linkUrl) {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: linkUrl })
        .run();
      setLinkUrl("");
      setShowLinkInput(false);
    }
  };

  const removeLink = () => {
    editor.chain().focus().unsetLink().run();
  };

  const addImage = () => {
    if (imageUrl) {
      editor.chain().focus().setImage({ src: imageUrl }).run();
      setImageUrl("");
      setShowImageInput(false);
    }
  };

  const handleImageFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !onImageUpload) return;
    setUploadingImage(true);
    try {
      const url = await onImageUpload(file);
      editor.chain().focus().setImage({ src: url }).run();
    } catch (err) {
      alert("이미지 업로드 실패: " + err.message);
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  const ToolbarButton = ({ onClick, active, disabled, children, title }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
        active
          ? "bg-blue-600 text-white"
          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      {children}
    </button>
  );

  return (
    <div className="bg-gray-50 border-b border-gray-300 p-2">
      <div className="flex flex-wrap gap-1">
        {/* Text Formatting */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="굵게"
        >
          <strong>B</strong>
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="기울임"
        >
          <em>I</em>
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive("strike")}
          title="취소선"
        >
          <s>S</s>
        </ToolbarButton>

        <div className="w-px bg-gray-300 mx-1" />

        {/* Text Color */}
        <div className="flex gap-1">
          <ToolbarButton
            onClick={() => editor.chain().focus().setColor("#000000").run()}
            title="검정"
          >
            <span className="text-black">A</span>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setColor("#ef4444").run()}
            title="빨강"
          >
            <span className="text-red-500">A</span>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setColor("#3b82f6").run()}
            title="파랑"
          >
            <span className="text-blue-500">A</span>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setColor("#22c55e").run()}
            title="초록"
          >
            <span className="text-green-500">A</span>
          </ToolbarButton>
        </div>

        <div className="w-px bg-gray-300 mx-1" />

        {/* Highlight */}
        <ToolbarButton
          onClick={() =>
            editor.chain().focus().toggleHighlight({ color: "#fef08a" }).run()
          }
          active={editor.isActive("highlight", { color: "#fef08a" })}
          title="형광펜"
        >
          <span className="bg-yellow-200 px-1">H</span>
        </ToolbarButton>

        <div className="w-px bg-gray-300 mx-1" />

        {/* Lists */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          title="글머리 기호"
        >
          • 목록
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          title="번호 매기기"
        >
          1. 목록
        </ToolbarButton>

        <div className="w-px bg-gray-300 mx-1" />

        {/* Link */}
        <ToolbarButton
          onClick={() => {
            if (editor.isActive("link")) {
              removeLink();
            } else {
              setShowLinkInput(!showLinkInput);
            }
          }}
          active={editor.isActive("link")}
          title="링크"
        >
          🔗
        </ToolbarButton>

        {/* Image: URL */}
        <ToolbarButton
          onClick={() => setShowImageInput(!showImageInput)}
          title="이미지 URL"
        >
          🖼️
        </ToolbarButton>

        {/* Image: File Upload */}
        {onImageUpload && (
          <>
            <ToolbarButton
              onClick={() => imageFileRef.current?.click()}
              disabled={uploadingImage}
              title="이미지 파일 업로드"
            >
              {uploadingImage ? "⏳" : "📤"}
            </ToolbarButton>
            <input
              ref={imageFileRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={handleImageFileChange}
            />
          </>
        )}

        <div className="w-px bg-gray-300 mx-1" />

        {/* Clear Formatting */}
        <ToolbarButton
          onClick={() => editor.chain().focus().unsetAllMarks().run()}
          title="서식 지우기"
        >
          ✕
        </ToolbarButton>
      </div>

      {/* Link Input */}
      {showLinkInput && (
        <div className="mt-2 flex gap-2">
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://example.com"
            className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addLink();
              }
            }}
          />
          <button
            type="button"
            onClick={addLink}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            추가
          </button>
          <button
            type="button"
            onClick={() => {
              setShowLinkInput(false);
              setLinkUrl("");
            }}
            className="px-3 py-1.5 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400"
          >
            취소
          </button>
        </div>
      )}

      {/* Image URL Input */}
      {showImageInput && (
        <div className="mt-2 flex gap-2">
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="이미지 URL (https://...)"
            className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addImage();
              }
            }}
          />
          <button
            type="button"
            onClick={addImage}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            추가
          </button>
          <button
            type="button"
            onClick={() => {
              setShowImageInput(false);
              setImageUrl("");
            }}
            className="px-3 py-1.5 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400"
          >
            취소
          </button>
        </div>
      )}
    </div>
  );
}
