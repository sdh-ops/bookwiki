"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import { useEffect, useRef } from "react";
import EditorToolbar from "./EditorToolbar";

export default function Editor({ content, onChange, onImageUpload }) {
  // ref로 최신 onImageUpload 유지 (stale closure 방지)
  const onImageUploadRef = useRef(onImageUpload);
  useEffect(() => {
    onImageUploadRef.current = onImageUpload;
  }, [onImageUpload]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-blue-600 underline hover:text-blue-800",
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: "max-w-full h-auto rounded-lg my-4",
        },
      }),
      TextStyle,
      Color,
      Highlight.configure({
        multicolor: true,
      }),
    ],
    content: content || "",
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html);
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none min-h-[300px] max-w-none p-4",
      },
      // 에디터 영역으로 이미지 드래그앤드롭
      handleDrop(view, event, _slice, moved) {
        if (moved || !onImageUploadRef.current) return false;
        const files = event.dataTransfer?.files;
        if (!files?.length) return false;
        const imageFile = Array.from(files).find((f) => f.type.startsWith("image/"));
        if (!imageFile) return false;

        event.preventDefault();
        onImageUploadRef.current(imageFile)
          .then((url) => {
            const { schema } = view.state;
            const node = schema.nodes.image.create({
              src: url,
              class: "max-w-full h-auto rounded-lg my-4",
            });
            const tr = view.state.tr.replaceSelectionWith(node);
            view.dispatch(tr);
          })
          .catch((err) => alert("이미지 업로드 실패: " + err.message));
        return true;
      },
      // 클립보드 이미지 붙여넣기 (스크린샷 포함)
      handlePaste(view, event) {
        if (!onImageUploadRef.current) return false;
        const items = Array.from(event.clipboardData?.items || []);
        const imageItem = items.find((item) => item.type.startsWith("image/"));
        if (!imageItem) return false;

        event.preventDefault();
        const file = imageItem.getAsFile();
        onImageUploadRef.current(file)
          .then((url) => {
            const { schema } = view.state;
            const node = schema.nodes.image.create({
              src: url,
              class: "max-w-full h-auto rounded-lg my-4",
            });
            const tr = view.state.tr.replaceSelectionWith(node);
            view.dispatch(tr);
          })
          .catch((err) => alert("이미지 업로드 실패: " + err.message));
        return true;
      },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content || "");
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      <EditorToolbar editor={editor} onImageUpload={onImageUpload} />
      <EditorContent editor={editor} className="bg-white" />
    </div>
  );
}
