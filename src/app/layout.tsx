import type { Metadata } from "next";

import { AppStateProvider } from "@/lib/app-state";
import { SiteShell } from "@/components/site-shell";

import "./globals.css";

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
    <html lang="zh-CN">
      <body>
        <AppStateProvider>
          <SiteShell>{children}</SiteShell>
        </AppStateProvider>
      </body>
    </html>
  );
}
