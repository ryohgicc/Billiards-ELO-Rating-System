export type Player = {
  id: string;
  name: string;
  createdAt: string;
  isActive: boolean;
};

export type PlayerPhoto = {
  id: string;
  playerId: string;
  imageData: string;
  createdAt: string;
};

export type PlayerAiProfile = {
  playerId: string;
  titleLabel: string;
  titleCategory: "legend" | "fun";
  titleReason: string;
  evaluation: string;
  marketValueUsd: number;
  updatedAt: string;
  model: string;
};

export type MatchAiReview = {
  matchId: string;
  review: string;
  winnerEvaluation: string;
  loserEvaluation: string;
  updatedAt: string;
  model: string;
};

export type AiModelConfig = {
  model: string;
  isEnabled: boolean;
  failureCount: number;
  lastError: string;
  lastTriedAt?: string;
  lastSucceededAt?: string;
  createdAt: string;
};

export type MatchSide = "winner" | "loser";

export type MatchMomentKey =
  | "clearance_runout"
  | "shutout"
  | "win_by_3"
  | "win_by_5"
  | "comeback_win"
  | "hill_hill_finish"
  | "scratch_black_8"
  | "double_scratch"
  | "hill_hill_meltdown";

export type MatchMomentDefinition = {
  key: MatchMomentKey;
  label: string;
  description: string;
  roles: MatchSide[];
  tone: "glory" | "chaos";
  aiWeight: number;
};

export type MatchRecord = {
  id: string;
  winnerId: string;
  loserId: string;
  createdAt: string;
  winnerMoments: MatchMomentKey[];
  loserMoments: MatchMomentKey[];
  winnerNote: string;
  loserNote: string;
};

export type AppSettings = {
  title: string;
  kFactor: number;
};

export type AppState = {
  players: Player[];
  matches: MatchRecord[];
  photos: PlayerPhoto[];
  aiProfiles: PlayerAiProfile[];
  aiReviews: MatchAiReview[];
  aiModels: AiModelConfig[];
  settings: AppSettings;
};

export type MatchTimelineEntry = MatchRecord & {
  winnerName: string;
  loserName: string;
  winnerDelta: number;
  loserDelta: number;
  winnerRatingAfter: number;
  loserRatingAfter: number;
};

export type PlayerStats = {
  player: Player;
  rating: number;
  wins: number;
  losses: number;
  currentWinStreak: number;
  currentLossStreak: number;
  bestWinStreak: number;
  worstLossStreak: number;
  lastMatchAt?: string;
};

export type RankingEntry = PlayerStats & {
  rank: number;
  winRate: number;
};

export type PlayerTitle = {
  key: string;
  label: string;
  category: "legend" | "fun";
  reason: string;
};

export type PlayerAchievement = {
  key: string;
  label: string;
  detail: string;
  value: number;
  tone: "glory" | "chaos";
};

export type PlayerRecentMatch = {
  id: string;
  createdAt: string;
  result: "W" | "L";
  opponentName: string;
  ratingDelta: number;
  scoreline: string;
  moments: string[];
  note: string;
};

export type PlayerRecentForm = {
  wins: number;
  losses: number;
  trend: Array<"W" | "L">;
};

export type PlayerMarketValue = {
  amountUsd: number;
  tier: string;
  summary: string;
  factors: string[];
};

export type PlayerProfile = {
  playerId: string;
  title: PlayerTitle | null;
  titleSource: "rules" | "ai";
  unlockedTitles: PlayerTitle[];
  achievements: PlayerAchievement[];
  photos: PlayerPhoto[];
  featuredPhoto: PlayerPhoto | null;
  photoCount: number;
  rating: number;
  wins: number;
  losses: number;
  totalMatches: number;
  winRate: number;
  lastMatchAt?: string;
  bestWinStreak: number;
  worstLossStreak: number;
  currentWinStreak: number;
  currentLossStreak: number;
  recentForm: PlayerRecentForm;
  recentMatches: PlayerRecentMatch[];
  evaluation: string;
  marketValue: PlayerMarketValue;
  marketValueSource: "rules" | "ai";
  aiModel: string | null;
  notableMoments: string[];
  aiHooks: string[];
};
