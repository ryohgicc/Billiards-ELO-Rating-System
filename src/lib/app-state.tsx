"use client";

import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useState,
} from "react";

import { api } from "@/lib/api";
import { DEFAULT_K_FACTOR, DEFAULT_SETTINGS } from "@/lib/constants";
import { buildMatchTimeline, buildRankings, calculateMatchDelta, replayMatches } from "@/lib/rating";
import { createEmptyState, importState } from "@/lib/storage";
import type { AppState, Player } from "@/lib/types";
import { validateMatchPlayers, validatePlayerName } from "@/lib/validation";

type MatchFeedback = {
  winnerName: string;
  loserName: string;
  winnerDelta: number;
  loserDelta: number;
};

type AppStateContextValue = {
  state: AppState;
  isLoaded: boolean;
  loadError: string;
  rankings: ReturnType<typeof buildRankings>;
  timeline: ReturnType<typeof buildMatchTimeline>;
  activePlayers: Player[];
  createPlayer: (name: string) => Promise<void>;
  togglePlayer: (playerId: string) => Promise<void>;
  updatePlayerName: (playerId: string, name: string) => Promise<void>;
  addMatch: (winnerId: string, loserId: string) => Promise<MatchFeedback>;
  removeMatch: (matchId: string) => Promise<void>;
  updateTitle: (title: string) => Promise<void>;
  replaceStateFromImport: (payload: string) => Promise<void>;
  clearAllData: () => Promise<void>;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(createEmptyState);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let isMounted = true;

    api
      .getState()
      .then((nextState) => {
        if (!isMounted) {
          return;
        }

        startTransition(() => {
          setState(nextState);
          setLoadError("");
          setIsLoaded(true);
        });
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        setLoadError(error instanceof Error ? error.message : "读取云端数据失败");
        setIsLoaded(true);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const rankings = buildRankings(state.players, state.matches, state.settings.kFactor);
  const timeline = buildMatchTimeline(state.players, state.matches, state.settings.kFactor);
  const activePlayers = state.players.filter((player) => player.isActive);

  const value: AppStateContextValue = {
    state,
    isLoaded,
    loadError,
    rankings,
    timeline,
    activePlayers,
    async createPlayer(name) {
      validatePlayerName(name, state.players);
      setState(await api.createPlayer(name));
    },
    async togglePlayer(playerId) {
      setState(await api.togglePlayer(playerId));
    },
    async updatePlayerName(playerId, name) {
      validatePlayerName(name, state.players, playerId);
      setState(await api.updatePlayerName(playerId, name));
    },
    async addMatch(winnerId, loserId) {
      validateMatchPlayers(winnerId, loserId, state.players);

      const snapshots = replayMatches(state.players, state.matches, state.settings.kFactor);
      const winner = snapshots[winnerId];
      const loser = snapshots[loserId];

      if (!winner || !loser) {
        throw new Error("球员不存在");
      }

      const delta = calculateMatchDelta(
        winner.rating,
        loser.rating,
        state.settings.kFactor ?? DEFAULT_K_FACTOR,
      );

      setState(await api.createMatch(winnerId, loserId));

      return {
        winnerName: winner.player.name,
        loserName: loser.player.name,
        winnerDelta: delta.winnerDelta,
        loserDelta: delta.loserDelta,
      };
    },
    async removeMatch(matchId) {
      setState(await api.deleteMatch(matchId));
    },
    async updateTitle(title) {
      const normalized = title.trim();
      setState(await api.updateTitle(normalized || DEFAULT_SETTINGS.title));
    },
    async replaceStateFromImport(payload) {
      const nextState = importState(payload);
      setState(await api.replaceState(nextState));
    },
    async clearAllData() {
      setState(await api.clearState());
    },
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);

  if (!context) {
    throw new Error("useAppState 必须在 AppStateProvider 内使用");
  }

  return context;
}
