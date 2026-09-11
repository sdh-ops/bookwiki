import Link from "next/link";

// 홈과 글 상세가 각자 들고 있던 푸터를 하나로 (글 상세엔 문의 메일이 빠져 있었다)
export default function SiteFooter({ narrow = false }) {
  return (
    <footer className="mt-10 border-t border-gray-200 bg-gray-50 py-10">
      <div className={`${narrow ? "max-w-4xl" : "max-w-6xl"} mx-auto px-4 text-center text-xs text-gray-500`}>
        <p className="mb-3">© 2026 북위키 (Book-Wiki). All rights reserved.</p>
        <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <span>
            문의{" "}
            <a href="mailto:bookwiki.official@gmail.com" className="text-[#355E3B] hover:underline py-2">
              bookwiki.official@gmail.com
            </a>
          </span>
          <Link href="/terms" className="hover:underline py-2">
            이용약관
          </Link>
          <Link href="/privacy" className="hover:underline py-2">
            개인정보처리방침
          </Link>
        </p>
      </div>
    </footer>
  );
}
