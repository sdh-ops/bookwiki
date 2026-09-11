"use client";

import { useMemo, useSyncExternalStore } from "react";
// isomorphic-dompurify 는 서버에서 jsdom 을 끌어오는데, Vercel 에선 jsdom 이 파일을 못 찾아 글 상세가 통째로 500 이 났다.
// 본문 소독은 브라우저의 DOMPurify 로만 한다(서버는 본문 자리를 비워 두고 곧바로 채운다).
import DOMPurify from "dompurify";
import PollWidget from "@/components/PollWidget";
import { kstDateLabel } from "@/lib/date";

const JOB_CATEGORY_LABELS = {
  editing: "편집",
  marketing: "마케팅",
  design: "디자이너",
  production: "제작",
  sales: "영업",
  writer: "작가",
  other: "기타",
};

const EXPERIENCE_LABELS = {
  entry: "신입",
  "1-3": "1-3년",
  "3-5": "3-5년",
  "5-10": "5-10년",
  "10+": "10년 이상",
};

const SANITIZE_OPTIONS = {
  ADD_TAGS: ["iframe"],
  ADD_ATTR: ["src", "allowfullscreen", "frameborder", "allow"],
  ALLOWED_TAGS: [
    "address", "article", "aside", "footer", "header", "h1", "h2", "h3", "h4",
    "h5", "h6", "hgroup", "main", "nav", "section", "blockquote", "dd", "div",
    "dl", "dt", "figcaption", "figure", "hr", "li", "ol", "p", "pre",
    "ul", "a", "abbr", "b", "bdi", "bdo", "br", "cite", "code", "data", "dfn",
    "em", "i", "kbd", "mark", "q", "rb", "rp", "rt", "rtc", "ruby", "s", "samp",
    "small", "span", "strong", "sub", "sup", "time", "u", "var", "wbr", "caption",
    "col", "colgroup", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "img",
    "iframe",
  ],
  ALLOWED_ATTR: [
    "accept", "accesskey", "action", "align", "alt", "autocomplete", "autofocus",
    "autoplay", "bgcolor", "border", "challenge", "charset", "checked", "cite",
    "class", "cols", "colspan", "content", "contenteditable", "contextmenu",
    "controls", "coords", "data", "datetime", "default", "defer", "dir",
    "disabled", "download", "draggable", "enctype", "for", "form", "formaction",
    "formenctype", "formmethod", "formnovalidate", "formtarget", "headers",
    "height", "hidden", "high", "href", "hreflang", "http-equiv", "icon", "id",
    "importance", "integrity", "ismap", "itemprop", "keytype", "kind", "label",
    "lang", "list", "loop", "low", "manifest", "max", "maxlength", "media",
    "method", "min", "minlength", "multiple", "muted", "name", "novalidate",
    "open", "optimum", "pattern", "placeholder", "poster", "preload", "radiogroup",
    "readonly", "rel", "required", "reversed", "rows", "rowspan", "sandbox",
    "scope", "scoped", "selected", "shape", "size", "sizes", "slot", "span",
    "spellcheck", "src", "srcdoc", "srclang", "srcset", "start", "step", "style",
    "summary", "tabindex", "target", "title", "translate", "type", "usemap",
    "value", "width", "wrap", "allowfullscreen", "frameborder", "allow",
  ],
};

function formatSize(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

// 첨부파일은 다른 도메인(스토리지)에 있어서 프록시로 받아야 파일명대로 저장된다
function downloadHref(att) {
  return `/api/download?url=${encodeURIComponent(att.url)}&name=${encodeURIComponent(att.name)}`;
}

function JobInfo({ post }) {
  const show = post.job_type || post.job_category || post.experience_level || post.deadline;
  if (post.board_type !== "job" || !show) return null;
  return (
    <div className="mt-2 mb-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
      <h2 className="text-sm font-bold text-gray-800 mb-3 flex items-center">
        <span className="text-lg mr-2" aria-hidden="true">📋</span> 채용 정보
      </h2>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        {post.job_type && (
          <div className="flex items-center">
            <dt className="font-bold text-gray-700">분류</dt>
            <dd className={`ml-2 px-2 py-0.5 rounded text-xs font-bold ${post.job_type === "hiring" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
              {post.job_type === "hiring" ? "구인 (채용)" : "구직 (지원 희망)"}
            </dd>
          </div>
        )}
        {post.job_category && (
          <div className="flex">
            <dt className="font-bold text-gray-700">직군</dt>
            <dd className="ml-2 text-gray-600">{JOB_CATEGORY_LABELS[post.job_category] || post.job_category}</dd>
          </div>
        )}
        {post.experience_level && (
          <div className="flex">
            <dt className="font-bold text-gray-700">경력</dt>
            <dd className="ml-2 text-gray-600">{EXPERIENCE_LABELS[post.experience_level] || post.experience_level}</dd>
          </div>
        )}
        <div className="flex">
          <dt className="font-bold text-gray-700">마감일</dt>
          <dd className="ml-2 text-gray-600">{post.deadline ? kstDateLabel(post.deadline) : "충원시"}</dd>
        </div>
      </dl>
    </div>
  );
}

function Attachments({ attachments }) {
  if (!attachments?.length) return null;
  return (
    <div className="mb-8 p-4 bg-gray-50 rounded-xl border border-gray-100">
      <h2 className="text-xs font-bold text-gray-500 mb-3 tracking-wide">첨부파일 ({attachments.length})</h2>
      <div className="space-y-3">
        {attachments.map((att, i) =>
          att.type?.startsWith("image/") ? (
            <figure key={i} className="bg-white rounded-lg border border-gray-100 overflow-hidden">
              <a href={att.url} target="_blank" rel="noopener noreferrer" title="원본 크기로 보기">
                {/* 사용자가 올린 외부 스토리지 이미지라 next/image 최적화 대상이 아니다 */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={att.url} alt={att.name} loading="lazy" className="w-full h-auto max-h-[600px] object-contain bg-gray-50" />
              </a>
              <figcaption className="flex items-center justify-between px-3 text-xs text-gray-500 border-t border-gray-100">
                <span className="truncate py-2">{att.name}</span>
                <a href={downloadHref(att)} className="flex-shrink-0 ml-2 px-2 py-2 hover:text-[#355E3B]">
                  ↓ 다운로드
                </a>
              </figcaption>
            </figure>
          ) : (
            <a
              key={i}
              href={downloadHref(att)}
              className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-100 hover:border-[#355E3B] hover:shadow-sm transition-all group"
            >
              <span className="text-xl flex-shrink-0" aria-hidden="true">📄</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 truncate group-hover:text-[#355E3B]">{att.name}</p>
                <p className="text-xs text-gray-500">{formatSize(att.size)}</p>
              </div>
              <span className="text-xs text-gray-500 group-hover:text-[#355E3B] flex-shrink-0">↓ 다운로드</span>
            </a>
          )
        )}
      </div>
    </div>
  );
}

function DocumentPreview({ url }) {
  if (!url) return null;
  const original = url.split("file=")[1] || url.split("src=")[1] || url;
  return (
    <div className="mb-10 p-1 bg-gray-100 rounded-lg border border-gray-200 overflow-hidden shadow-sm">
      <div className="bg-gray-100 px-3 py-1 text-xs font-bold text-gray-500 flex justify-between items-center">
        <span>📄 미리보기</span>
        <a href={original} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline py-2">
          새 창으로 열기
        </a>
      </div>
      <div className="relative w-full h-[70vh] max-h-[600px] bg-white">
        <iframe src={url} className="w-full h-full border-none" allowFullScreen title="문서 미리보기" />
      </div>
    </div>
  );
}

/** 글 본문 — 채용 정보 · 본문 · 투표 · 첨부 · 문서 미리보기 */
const noSubscribe = () => () => {};

export default function PostBody({ post, postId, user }) {
  const inBrowser = useSyncExternalStore(noSubscribe, () => true, () => false);
  const html = useMemo(
    () => (inBrowser ? DOMPurify.sanitize(post.content || "", SANITIZE_OPTIONS) : ""),
    [inBrowser, post.content]
  );

  return (
    <div className="min-h-[200px] text-gray-800 leading-relaxed text-[15px] md:text-sm">
      <JobInfo post={post} />
      <div className="post-content prose prose-sm max-w-none mb-6 overflow-x-auto break-words [overflow-wrap:anywhere]" dangerouslySetInnerHTML={{ __html: html }} />
      {post.poll_options?.length > 0 && <PollWidget postId={postId} pollOptions={post.poll_options} user={user} />}
      <Attachments attachments={post.attachments} />
      <DocumentPreview url={post.preview_url} />
    </div>
  );
}
