import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import PageTracker from "@/components/PageTracker";
import Header from "@/components/Header";
import NotifyHost from "@/components/NotifyHost";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  metadataBase: new URL("https://www.bookwiki.co.kr"),
  title: {
    default: "북위키 (BookWiki) | 출판업계 정보 공유 플랫폼",
    template: "%s | 북위키"
  },
  description: "북위키는 출판업계 종사자들을 위한 실시간 구인구직, 지원사업 정보, 업계 트렌드 분석 및 커뮤니티 공간입니다.",
  keywords: ["출판", "출판업계", "북위키", "BookWiki", "출판 구인구직", "출판 지원사업", "편집자", "마케터", "디자이너"],
  authors: [{ name: "북위키 팀" }],
  creator: "북위키",
  publisher: "북위키",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
  openGraph: {
    title: "북위키 (BookWiki) | 출판업계 정보 공유 플랫폼",
    description: "출판업계 종사자들의 필수 커뮤니티! 구인구직부터 지원사업까지 한눈에 확인하세요.",
    url: "https://bookwiki.co.kr",
    siteName: "북위키",
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "북위키 (BookWiki) | 출판업계 정보 공유 플랫폼",
    description: "출판업계 종사자들의 필수 커뮤니티! 구인구직부터 지원사업까지 한눈에 확인하세요.",
  },
  robots: {
    index: true,
    follow: true,
  },
  // canonical 은 여기서 정하지 않는다. 루트에 두면 모든 하위 화면이 물려받아
  // 글 상세까지 전부 「정본은 홈」이라고 검색엔진에 알리게 된다. 글 상세는 자기 주소를 적는다.
  verification: {
    other: {
      "naver-site-verification": "931ec1217c2427fde23e687a8a2d02f91c87532a",
    },
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "북위키",
  "url": "https://bookwiki.co.kr",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://bookwiki.co.kr/?board=all&q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Header />
        {children}
        <NotifyHost />
        <PageTracker />
        <Analytics />
      </body>
    </html>
  );
}
