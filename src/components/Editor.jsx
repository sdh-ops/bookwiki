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
import { toast } from "@/lib/notify";
import { fetchImageAsFile, isExternalImageUrl, isTemporaryImageUrl } from "@/lib/externalImages";

/** 문서 안 이미지 중 src 가 같은 노드 위치(뒤에서부터 — 지워도 앞 위치가 안 밀린다) */
function imagePositions(doc, src) {
  const found = [];
  doc.descendants((node, pos) => {
    if (node.type.name === "image" && node.attrs.src === src) found.push(pos);
  });
  return found.reverse();
}

/**
 * 붙여 넣은 바깥 이미지를 우리 저장소로 옮긴다.
 * 못 옮긴 것 중 임시 주소(곧 만료)는 글에서 빼고 알린다 — 남겨 두면 몇 분 뒤 깨진다.
 * 임시가 아닌 바깥 주소는 그대로 둔다(그 사이트가 살아 있는 동안은 보인다).
 */
async function rehostExternalImages(view, upload) {
  const srcs = new Set();
  view.state.doc.descendants((node) => {
    if (node.type.name === "image" && isExternalImageUrl(node.attrs.src)) srcs.add(node.attrs.src);
  });
  if (!srcs.size) return;

  let moved = 0;
  let dropped = 0;
  for (const src of srcs) {
    const file = await fetchImageAsFile(src);
    let url = null;
    if (file) {
      try {
        url = await upload(file);
      } catch {
        url = null;
      }
    }
    if (view.isDestroyed) return;
    const positions = imagePositions(view.state.doc, src);
    if (!positions.length) continue;
    const tr = view.state.tr;
    if (url) {
      positions.forEach((pos) => {
        const node = tr.doc.nodeAt(pos);
        if (node) tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: url });
      });
      moved += 1;
    } else if (isTemporaryImageUrl(src)) {
      positions.forEach((pos) => {
        const node = tr.doc.nodeAt(pos);
        if (node) tr.delete(pos, pos + node.nodeSize);
      });
      dropped += 1;
    } else {
      continue;
    }
    view.dispatch(tr);
  }

  if (dropped) {
    toast(
      `붙여 넣은 이미지 ${dropped}장은 곧 사라지는 임시 주소라 뺐습니다. 이미지를 파일로 저장한 뒤 끌어다 놓거나 붙여 넣어 주세요.`,
      "error",
    );
  } else if (moved) {
    toast(`붙여 넣은 이미지 ${moved}장을 북위키에 올렸습니다.`);
  }
}

export default function Editor({ content, onChange, onImageUpload }) {
  // ref로 최신 onImageUpload 유지 (stale closure 방지)
  const onImageUploadRef = useRef(onImageUpload);
  useEffect(() => {
    onImageUploadRef.current = onImageUpload;
  }, [onImageUpload]);

  const editor = useEditor({
    // Next.js 에서는 명시하지 않으면 개발 모드에서 Tiptap 이 예외를 던져 글쓰기·수정 화면이 통째로 죽는다
    // (운영 빌드는 조용히 false 로 동작 — 그 동작을 그대로 적어 둔 것)
    immediatelyRender: false,
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
          .catch((err) => toast(`이미지를 올리지 못했습니다: ${err.message}`, "error"));
        return true;
      },
      // 클립보드 이미지 붙여넣기 (스크린샷 포함)
      handlePaste(view, event) {
        if (!onImageUploadRef.current) return false;
        const items = Array.from(event.clipboardData?.items || []);
        const imageItem = items.find((item) => item.type.startsWith("image/"));
        if (!imageItem) {
          // 웹 화면을 복사해 붙이면 이미지가 바깥 주소로 들어온다 — 붙인 뒤 우리 저장소로 옮긴다
          const html = event.clipboardData?.getData("text/html");
          if (html && /<img\b/i.test(html)) {
            setTimeout(() => rehostExternalImages(view, onImageUploadRef.current), 0);
          }
          return false;
        }

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
          .catch((err) => toast(`이미지를 올리지 못했습니다: ${err.message}`, "error"));
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
