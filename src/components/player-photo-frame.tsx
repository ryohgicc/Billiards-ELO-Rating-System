"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";

import type { PlayerPhoto } from "@/lib/types";

type PlayerPhotoFrameProps = {
  playerId: string;
  playerName: string;
  photo: PlayerPhoto | null;
  href?: string;
  compact?: boolean;
  hideText?: boolean;
};

const photoRoleLabels: Record<PlayerPhoto["role"], string> = {
  default: "球员图片",
  victory: "胜利图片",
  defeat: "失败图片",
};

function PlayerPhotoFrameInner({
  playerName,
  photo,
  compact = false,
  hideText = false,
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
          {hideText ? null : <span>{playerName.slice(0, 1).toUpperCase()}</span>}
        </div>
      )}
      {hideText ? null : (
        <div className="player-photo-frame__overlay">
          <strong>{playerName}</strong>
          <span>{photo ? photoRoleLabels[photo.role] : "暂无照片"}</span>
        </div>
      )}
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
