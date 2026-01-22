import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mommy Wisdom 會計系統",
  description: "企業會計管理系統 - Mommy Wisdom International Co.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
