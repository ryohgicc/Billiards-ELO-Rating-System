import type { AppState } from "@/lib/types";

async function requestState(path: string, init?: RequestInit): Promise<AppState> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "请求失败");
  }

  return response.json();
}

export const api = {
  getState() {
    return requestState("/api/state");
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
  createMatch(winnerId: string, loserId: string) {
    return requestState("/api/matches", {
      method: "POST",
      body: JSON.stringify({ winnerId, loserId }),
    });
  },
  deleteMatch(matchId: string) {
    return requestState(`/api/matches/${encodeURIComponent(matchId)}`, {
      method: "DELETE",
    });
  },
  updateTitle(title: string) {
    return requestState("/api/settings", {
      method: "PUT",
      body: JSON.stringify({ title }),
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
};
