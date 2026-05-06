"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";

import type { PlayerPhoto } from "@/lib/types";

type PlayerPhotoFrameProps = {
  playerId: string;
  playerName: string;
  photo: PlayerPhoto | null;
  photoCount?: number;
  href?: string;
  compact?: boolean;
};

function PlayerPhotoFrameInner({
  playerName,
  photo,
  photoCount = 0,
  compact = false,
}: Omit<PlayerPhotoFrameProps, "playerId" | "href">) {
  return (
    <div className={compact ? "player-photo-frame player-photo-frame--compact" : "player-photo-frame"}>
      {photo ? (
        <img
          alt={`${playerName} 的球员照片`}
          className="player-photo-frame__image"
          loading="lazy"
          src={photo.imageData}
        />
      ) : (
        <div className="player-photo-frame__placeholder" aria-hidden="true">
          <span>{playerName.slice(0, 1).toUpperCase()}</span>
        </div>
      )}
      <div className="player-photo-frame__overlay">
        <strong>{playerName}</strong>
        <span>{photoCount > 0 ? `${photoCount} 张照片轮播中` : "暂无照片"}</span>
      </div>
    </div>
  );
}

export function PlayerPhotoFrame({ href, ...props }: PlayerPhotoFrameProps) {
  if (href) {
    return (
      <Link className="player-photo-frame__link" href={href}>
        <PlayerPhotoFrameInner {...props} />
      </Link>
    );
  }

  return <PlayerPhotoFrameInner {...props} />;
}
