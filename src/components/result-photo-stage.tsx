"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";

import type { PlayerPhoto, PlayerPhotoRole } from "@/lib/types";

type ResultPhotoRole = Extract<PlayerPhotoRole, "victory" | "defeat">;

type ResultPhotoStageProps = {
  playerId: string;
  playerName: string;
  photos: PlayerPhoto[];
  profileHref?: string;
  uploadingPhotoTarget?: string;
  onPhotoUpload?: (
    playerId: string,
    role: ResultPhotoRole,
    files: FileList | null,
  ) => Promise<void>;
};

const resultPhotoSlots: Array<{
  role: ResultPhotoRole;
  label: string;
  uploadLabel: string;
  eyebrow: string;
}> = [
  {
    role: "victory",
    label: "胜利图片",
    uploadLabel: "上传胜利图片",
    eyebrow: "WIN",
  },
  {
    role: "defeat",
    label: "失败图片",
    uploadLabel: "上传失败图片",
    eyebrow: "LOSS",
  },
];

export function ResultPhotoStage({
  playerId,
  playerName,
  photos,
  profileHref,
  uploadingPhotoTarget = "",
  onPhotoUpload,
}: ResultPhotoStageProps) {
  const photosByRole = photos.reduce<Partial<Record<ResultPhotoRole, PlayerPhoto>>>(
    (accumulator, photo) => {
      if (photo.role === "victory" || photo.role === "defeat") {
        accumulator[photo.role] = photo;
      }

      return accumulator;
    },
    {},
  );

  return (
    <div className="result-photo-stage-wrap">
      <div className="result-photo-stage" aria-label={`${playerName} 的胜负图片`}>
        {resultPhotoSlots.map(({ role, label, uploadLabel, eyebrow }) => {
          const inputId = `player-photo-${role}-${playerId}`;
          const isUploading = uploadingPhotoTarget === `${playerId}:${role}`;
          const photo = photosByRole[role] ?? null;

          return (
            <div
              key={role}
              className={`result-photo-card result-photo-card--${role}${
                onPhotoUpload ? "" : " result-photo-card--readonly"
              }`}
            >
              <div className="result-photo-card__image-wrap">
                {photo ? (
                  <img
                    alt={`${playerName} 的${label}`}
                    className="result-photo-card__image"
                    loading="lazy"
                    src={photo.imageData}
                  />
                ) : (
                  <div className="result-photo-card__placeholder" aria-hidden="true">
                    <span>{playerName.slice(0, 1).toUpperCase()}</span>
                  </div>
                )}
                <div className="result-photo-card__shine" aria-hidden="true" />
              </div>
              <div className="result-photo-card__caption">
                <span>{eyebrow}</span>
                <strong>{label}</strong>
              </div>
              {onPhotoUpload ? (
                <>
                  <label className="result-photo-card__upload" htmlFor={inputId}>
                    {isUploading ? "上传中..." : photo ? "替换" : uploadLabel}
                  </label>
                  <input
                    accept="image/*"
                    className="sr-only"
                    id={inputId}
                    onChange={(event) => {
                      onPhotoUpload(playerId, role, event.target.files).catch(() => undefined);
                      event.target.value = "";
                    }}
                    type="file"
                  />
                </>
              ) : null}
            </div>
          );
        })}
      </div>
      {profileHref ? (
        <Link className="result-photo-stage__profile-link" href={profileHref}>
          查看球员档案
        </Link>
      ) : null}
    </div>
  );
}
