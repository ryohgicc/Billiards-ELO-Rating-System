import type { Metadata } from "next";
import { Noto_Sans_SC } from "next/font/google";

import { AppStateProvider } from "@/lib/app-state";
import { SiteShell } from "@/components/site-shell";

import "./globals.css";

const notoSansSc = Noto_Sans_SC({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "台球积分榜",
  description: "创建球员、录入胜负、自动计算 Elo 排名的免费台球积分系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={notoSansSc.variable}>
      <body>
        <AppStateProvider>
          <SiteShell>{children}</SiteShell>
        </AppStateProvider>
      </body>
    </html>
  );
}
