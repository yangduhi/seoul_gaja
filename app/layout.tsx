import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "서울 인파 레이더 · Calm Glass",
  description: "서울의 현재 혼잡도와 공식 예측을 가족의 다음 시간으로 바꾸는 지도",
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
      <body>{children}</body>
    </html>
  );
}
