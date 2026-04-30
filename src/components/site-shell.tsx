"use client";

import {
  BookOpen,
  Clock3,
  Database,
  GraduationCap,
  ListOrdered,
  PlusCircle,
  Trophy,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAppState } from "@/lib/app-state";

const links = [
  { href: "/", label: "排行榜", icon: ListOrdered },
  { href: "/matches", label: "录入比赛", icon: PlusCircle },
  { href: "/players", label: "球员管理", icon: Users },
  { href: "/history", label: "比赛历史", icon: Clock3 },
  { href: "/academy", label: "台球学堂", icon: GraduationCap },
  { href: "/settings", label: "数据设置", icon: Database },
  { href: "/algorithm", label: "算法说明", icon: BookOpen },
];

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { state, rankings, loadError } = useAppState();

  return (
    <div className="shell">
      <header className="hero">
        <div className="hero__content">
          <p className="eyebrow">Billiards Elo 台球榜</p>
          <h1>{state.settings.title}</h1>
          <p className="hero__copy">
            用共享 Elo 数据库管理台球对战，创建球员、录入胜负、自动刷新排名。
          </p>
          <div className="hero__badges" aria-label="台球元素">
            <span>8 BALL</span>
            <span>CUE LINE</span>
            <span>BREAK POINT</span>
          </div>
        </div>

        <div className="hero__visual">
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
              <strong>
                <Trophy aria-hidden="true" size={18} />
                {rankings[0]?.player.name ?? "待定"}
              </strong>
            </div>
          </div>
        </div>
      </header>

      <nav className="nav-tabs" aria-label="主导航">
        {links.map((link) => {
          const isActive = pathname === link.href;

          const Icon = link.icon;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={isActive ? "nav-tabs__link nav-tabs__link--active" : "nav-tabs__link"}
            >
              <Icon aria-hidden="true" size={17} />
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
