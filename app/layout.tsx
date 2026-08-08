import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "서울 가자 — 인파 레이더",
  description: "서울 곳곳의 혼잡도와 공식 예측을 한눈에 보고 다음 시간을 천천히 고르세요.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
