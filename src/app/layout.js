import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "북위키",
  description: "북위키는 출판업계 종사자들을 위한 정보 공유 플랫폼입니다",
  icons: {
    icon: "/icon.png",
  },
  verification: {
    other: {
      "naver-site-verification": "d7b31dd3e853956c0b3e45fe8e15dc97c0abb8ba",
    },
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
