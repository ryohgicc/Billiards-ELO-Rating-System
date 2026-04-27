"use client";

import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useState,
} from "react";

import { DEFAULT_K_FACTOR, DEFAULT_SETTINGS } from "@/lib/constants";
import { buildMatchTimeline, buildRankings, calculateMatchDelta, replayMatches } from "@/lib/rating";
import { createEmptyState, importState, loadState, saveState } from "@/lib/storage";
import type { AppState, MatchRecord, Player } from "@/lib/types";
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
  rankings: ReturnType<typeof buildRankings>;
  timeline: ReturnType<typeof buildMatchTimeline>;
  activePlayers: Player[];
  createPlayer: (name: string) => void;
  togglePlayer: (playerId: string) => void;
  addMatch: (winnerId: string, loserId: string) => MatchFeedback;
  removeMatch: (matchId: string) => void;
  updateTitle: (title: string) => void;
  replaceStateFromImport: (payload: string) => void;
  clearAllData: () => void;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(createEmptyState);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    startTransition(() => {
      setState(loadState());
      setIsLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    saveState(state);
  }, [isLoaded, state]);

  const rankings = buildRankings(state.players, state.matches, state.settings.kFactor);
  const timeline = buildMatchTimeline(state.players, state.matches, state.settings.kFactor);
  const activePlayers = state.players.filter((player) => player.isActive);

  const value: AppStateContextValue = {
    state,
    isLoaded,
    rankings,
    timeline,
    activePlayers,
    createPlayer(name) {
      setState((current) => {
        const normalizedName = validatePlayerName(name, current.players);
        const player: Player = {
          id: createId("player"),
          name: normalizedName,
          createdAt: new Date().toISOString(),
          isActive: true,
        };

        return {
          ...current,
          players: [...current.players, player],
        };
      });
    },
    togglePlayer(playerId) {
      setState((current) => ({
        ...current,
        players: current.players.map((player) =>
          player.id === playerId ? { ...player, isActive: !player.isActive } : player,
        ),
      }));
    },
    addMatch(winnerId, loserId) {
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

      const nextMatch: MatchRecord = {
        id: createId("match"),
        winnerId,
        loserId,
        createdAt: new Date().toISOString(),
      };

      setState((current) => ({
        ...current,
        matches: [...current.matches, nextMatch],
      }));

      return {
        winnerName: winner.player.name,
        loserName: loser.player.name,
        winnerDelta: delta.winnerDelta,
        loserDelta: delta.loserDelta,
      };
    },
    removeMatch(matchId) {
      setState((current) => ({
        ...current,
        matches: current.matches.filter((match) => match.id !== matchId),
      }));
    },
    updateTitle(title) {
      const normalized = title.trim();

      setState((current) => ({
        ...current,
        settings: {
          ...current.settings,
          title: normalized || DEFAULT_SETTINGS.title,
        },
      }));
    },
    replaceStateFromImport(payload) {
      const nextState = importState(payload);
      setState(nextState);
    },
    clearAllData() {
      setState(createEmptyState());
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
