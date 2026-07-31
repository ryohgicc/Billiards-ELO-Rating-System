import type { AppState, MatchMomentKey, PlayerPhotoRole } from "@/lib/types";
import { ADMIN_TOKEN_STORAGE_KEY } from "@/lib/constants";

let adminToken = "";

function loadAdminToken() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) ?? "";
}

if (typeof window !== "undefined") {
  adminToken = loadAdminToken();
}

async function requestState(path: string, init?: RequestInit): Promise<AppState> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(init?.headers ? Object.fromEntries(new Headers(init.headers).entries()) : {}),
  };

  if (adminToken) {
    headers.authorization = `Bearer ${adminToken}`;
  }

  const response = await fetch(path, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "请求失败");
  }

  return response.json();
}

export const api = {
  getState(options?: { noStore?: boolean }) {
    return requestState("/api/state", options?.noStore ? { cache: "no-store" } : undefined);
  },
  createPlayer(name: string) {
    return requestState("/api/players", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  },
  togglePlayer(playerId: string) {
    return requestState(`/api/players/${encodeURIComponent(playerId)}`, {
      method: "PATCH",
    });
  },
  updatePlayerName(playerId: string, name: string) {
    return requestState(`/api/players/${encodeURIComponent(playerId)}`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    });
  },
  createPlayerPhotos(playerId: string, images: string[], role: PlayerPhotoRole = "default") {
    return requestState(`/api/players/${encodeURIComponent(playerId)}/photos`, {
      method: "POST",
      body: JSON.stringify({ images, role }),
    });
  },
  createMatch(
    winnerId: string,
    loserId: string,
    winnerMoments: MatchMomentKey[],
    loserMoments: MatchMomentKey[],
    winnerNote: string,
    loserNote: string,
  ) {
    return requestState("/api/matches", {
      method: "POST",
      body: JSON.stringify({
        winnerId,
        loserId,
        winnerMoments,
        loserMoments,
        winnerNote,
        loserNote,
      }),
    });
  },
  updateMatch(
    matchId: string,
    winnerId: string,
    loserId: string,
    winnerMoments: MatchMomentKey[],
    loserMoments: MatchMomentKey[],
    winnerNote: string,
    loserNote: string,
  ) {
    return requestState(`/api/matches/${encodeURIComponent(matchId)}`, {
      method: "PUT",
      body: JSON.stringify({
        winnerId,
        loserId,
        winnerMoments,
        loserMoments,
        winnerNote,
        loserNote,
      }),
    });
  },
  deleteMatch(matchId: string) {
    return requestState(`/api/matches/${encodeURIComponent(matchId)}`, {
      method: "DELETE",
    });
  },
  reorderMatch(matchId: string, targetMatchId: string) {
    return requestState(`/api/matches/${encodeURIComponent(matchId)}/reorder`, {
      method: "POST",
      body: JSON.stringify({ targetMatchId }),
    });
  },
  updateTitle(title: string) {
    return requestState("/api/settings", {
      method: "PUT",
      body: JSON.stringify({ title }),
    });
  },
  replaceAiModels(models: string[]) {
    return requestState("/api/ai-models", {
      method: "PUT",
      body: JSON.stringify({ models }),
    });
  },
  resetAiModel(model: string) {
    return requestState(`/api/ai-models/${encodeURIComponent(model)}/reset`, {
      method: "POST",
    });
  },
  backfillPendingAi(limit = 1) {
    return requestState(`/api/ai/backfill?limit=${encodeURIComponent(String(limit))}`, {
      method: "POST",
    });
  },
  replaceState(state: AppState) {
    return requestState("/api/state", {
      method: "PUT",
      body: JSON.stringify(state),
    });
  },
  clearState() {
    return requestState("/api/state", {
      method: "DELETE",
    });
  },
  getAdminToken() {
    return adminToken;
  },
  setAdminToken(token: string) {
    adminToken = token.trim();

    if (typeof window !== "undefined") {
      window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, adminToken);
    }
  },
};
