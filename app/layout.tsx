import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "給与計算アシスタント",
  description: "AIチャットで勤怠管理・給与計算ができるアプリ",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
