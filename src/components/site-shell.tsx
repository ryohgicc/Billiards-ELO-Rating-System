"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAppState } from "@/lib/app-state";

const links = [
  { href: "/", label: "排行榜" },
  { href: "/matches", label: "录入比赛" },
  { href: "/players", label: "球员管理" },
  { href: "/history", label: "比赛历史" },
  { href: "/settings", label: "数据设置" },
  { href: "/algorithm", label: "算法说明" },
];

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { state, rankings, loadError } = useAppState();

  return (
    <div className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Billiards Ladder</p>
          <h1>{state.settings.title}</h1>
          <p className="hero__copy">
            用本地 Elo 规则管理小范围台球对战，创建球员、录入胜负、自动刷新排名。
          </p>
        </div>
        <div className="hero__stats">
          <div className="stat-chip">
            <span>球员</span>
            <strong>{state.players.length}</strong>
          </div>
          <div className="stat-chip">
            <span>比赛</span>
            <strong>{state.matches.length}</strong>
          </div>
          <div className="stat-chip">
            <span>榜首</span>
            <strong>{rankings[0]?.player.name ?? "待定"}</strong>
          </div>
        </div>
      </header>

      <nav className="nav-tabs" aria-label="主导航">
        {links.map((link) => {
          const isActive = pathname === link.href;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={isActive ? "nav-tabs__link nav-tabs__link--active" : "nav-tabs__link"}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      {loadError ? <p className="feedback feedback--error">{loadError}</p> : null}

      <main className="page-frame">{children}</main>
    </div>
  );
}
