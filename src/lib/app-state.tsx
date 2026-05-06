"use client";

import {
  useCallback,
  createContext,
  startTransition,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { api } from "@/lib/api";
import { DEFAULT_K_FACTOR, DEFAULT_SETTINGS } from "@/lib/constants";
import { buildPlayerProfiles, mergeAiProfilesIntoPlayerProfiles } from "@/lib/player-honors";
import { buildMatchTimeline, buildRankings, calculateMatchDelta, replayMatches } from "@/lib/rating";
import { createEmptyState, importState } from "@/lib/storage";
import type { AppState, MatchMomentKey, Player, PlayerPhotoRole, PlayerProfile } from "@/lib/types";
import {
  validateAiModelList,
  validateMatchDetails,
  validateMatchPlayers,
  validatePlayerName,
  validatePlayerPhotoPayload,
} from "@/lib/validation";

type MatchFeedback = {
  matchId: string;
  winnerName: string;
  loserName: string;
  winnerDelta: number;
  loserDelta: number;
  winnerMoments: MatchMomentKey[];
  loserMoments: MatchMomentKey[];
  aiReview: string;
  aiReviewPending: boolean;
};

const MATCH_AI_POLL_ATTEMPTS = 8;
const MATCH_AI_POLL_INTERVAL_MS = 2500;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findLatestPendingAiMatchId(state: AppState) {
  const reviewedMatchIds = new Set(state.aiReviews.map((review) => review.matchId));

  return [...state.matches]
    .filter((match) => !reviewedMatchIds.has(match.id))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]?.id ?? "";
}

type AppStateContextValue = {
  state: AppState;
  isLoaded: boolean;
  loadError: string;
  rankings: ReturnType<typeof buildRankings>;
  timeline: ReturnType<typeof buildMatchTimeline>;
  profilesByPlayerId: Record<string, PlayerProfile>;
  activePlayers: Player[];
  createPlayer: (name: string) => Promise<void>;
  togglePlayer: (playerId: string) => Promise<void>;
  updatePlayerName: (playerId: string, name: string) => Promise<void>;
  addPlayerPhotos: (playerId: string, images: string[], role?: PlayerPhotoRole) => Promise<void>;
  replaceAiModels: (models: string[]) => Promise<void>;
  resetAiModel: (model: string) => Promise<void>;
  addMatch: (payload: {
    winnerId: string;
    loserId: string;
    winnerMoments: MatchMomentKey[];
    loserMoments: MatchMomentKey[];
    winnerNote: string;
    loserNote: string;
  }) => Promise<MatchFeedback>;
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
  const [photoSeed] = useState(() => Math.random().toString(36).slice(2));
  const isMountedRef = useRef(true);
  const lastBackfilledPendingMatchIdRef = useRef("");

  function applyServerState(nextState: AppState) {
    if (!isMountedRef.current) {
      return nextState;
    }

    startTransition(() => {
      setState(nextState);
    });

    return nextState;
  }

  const pollMatchAiArtifacts = useCallback(async (matchId: string) => {
    for (let attempt = 0; attempt < MATCH_AI_POLL_ATTEMPTS; attempt += 1) {
      await wait(MATCH_AI_POLL_INTERVAL_MS);

      if (!isMountedRef.current) {
        return;
      }

      try {
        const nextState = await api.getState({ noStore: true });

        if (!isMountedRef.current) {
          return;
        }

        startTransition(() => {
          setState(nextState);
        });

        if (nextState.aiReviews.some((review) => review.matchId === matchId)) {
          return;
        }
      } catch {
        return;
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
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
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    const latestPendingMatchId = findLatestPendingAiMatchId(state);

    if (!latestPendingMatchId) {
      lastBackfilledPendingMatchIdRef.current = "";
      return;
    }

    if (lastBackfilledPendingMatchIdRef.current === latestPendingMatchId) {
      return;
    }

    lastBackfilledPendingMatchIdRef.current = latestPendingMatchId;

    api
      .backfillPendingAi(1)
      .then((nextState) => {
        applyServerState(nextState);
        void pollMatchAiArtifacts(latestPendingMatchId);
      })
      .catch(() => undefined);
  }, [isLoaded, pollMatchAiArtifacts, state]);

  const rankings = buildRankings(state.players, state.matches, state.settings.kFactor);
  const timeline = buildMatchTimeline(state.players, state.matches, state.settings.kFactor);
  const profilesByPlayerId = mergeAiProfilesIntoPlayerProfiles(
    buildPlayerProfiles(
      state.players,
      state.matches,
      state.photos,
      state.settings.kFactor,
      photoSeed,
    ),
    state.aiProfiles,
  );
  const activePlayers = state.players.filter((player) => player.isActive);

  const value: AppStateContextValue = {
    state,
    isLoaded,
    loadError,
    rankings,
    timeline,
    profilesByPlayerId,
    activePlayers,
    async createPlayer(name) {
      validatePlayerName(name, state.players);
      applyServerState(await api.createPlayer(name));
    },
    async togglePlayer(playerId) {
      applyServerState(await api.togglePlayer(playerId));
    },
    async updatePlayerName(playerId, name) {
      validatePlayerName(name, state.players, playerId);
      applyServerState(await api.updatePlayerName(playerId, name));
    },
    async addPlayerPhotos(playerId, images, role = "default") {
      const payload = validatePlayerPhotoPayload(
        { images, role },
        state.photos.filter((photo) => photo.playerId === playerId).length,
      );
      applyServerState(await api.createPlayerPhotos(playerId, payload.images, payload.role));
    },
    async replaceAiModels(models) {
      const normalized = validateAiModelList({ models });
      applyServerState(await api.replaceAiModels(normalized));
    },
    async resetAiModel(model) {
      applyServerState(await api.resetAiModel(model));
    },
    async addMatch(payload) {
      const { winnerId, loserId } = payload;
      validateMatchPlayers(winnerId, loserId, state.players);
      const details = validateMatchDetails(payload);

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

      const nextState = await api.createMatch(
        winnerId,
        loserId,
        details.winnerMoments,
        details.loserMoments,
        details.winnerNote,
        details.loserNote,
      );
      applyServerState(nextState);
      const createdMatch = nextState.matches[nextState.matches.length - 1];
      const aiReview =
        nextState.aiReviews.find((review) => review.matchId === createdMatch?.id)?.review ?? "";
      const aiReviewPending = Boolean(createdMatch?.id) && !aiReview;

      if (createdMatch?.id && aiReviewPending) {
        void pollMatchAiArtifacts(createdMatch.id);
      }

      return {
        matchId: createdMatch?.id ?? "",
        winnerName: winner.player.name,
        loserName: loser.player.name,
        winnerDelta: delta.winnerDelta,
        loserDelta: delta.loserDelta,
        winnerMoments: details.winnerMoments,
        loserMoments: details.loserMoments,
        aiReview,
        aiReviewPending,
      };
    },
    async removeMatch(matchId) {
      applyServerState(await api.deleteMatch(matchId));
    },
    async updateTitle(title) {
      const normalized = title.trim();
      applyServerState(await api.updateTitle(normalized || DEFAULT_SETTINGS.title));
    },
    async replaceStateFromImport(payload) {
      const nextState = importState(payload);
      applyServerState(await api.replaceState(nextState));
    },
    async clearAllData() {
      applyServerState(await api.clearState());
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
