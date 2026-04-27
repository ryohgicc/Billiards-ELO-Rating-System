export type Player = {
  id: string;
  name: string;
  createdAt: string;
  isActive: boolean;
};

export type MatchRecord = {
  id: string;
  winnerId: string;
  loserId: string;
  createdAt: string;
};

export type AppSettings = {
  title: string;
  kFactor: number;
};

export type AppState = {
  players: Player[];
  matches: MatchRecord[];
  settings: AppSettings;
};

export type PlayerStats = {
  player: Player;
  rating: number;
  wins: number;
  losses: number;
  lastMatchAt?: string;
};

export type RankingEntry = PlayerStats & {
  rank: number;
  winRate: number;
};
