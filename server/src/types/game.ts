export interface Track {
  uri: string;
  name: string;
  artists: string[];
  albumArt: string | null;
  durationMs: number;
}

export interface Player {
  id: string;
  name: string;
}

export type RoundPhase = "playing" | "guessing" | "revealed";

export interface Round {
  index: number;
  track: Track;
  clipStartMs: number;
  clipDurationMs: number;
  phase: RoundPhase;
  guess: string | null;
  correct: boolean | null;
  buzzedBy: string | null;
}

export type GameStatus = "active" | "finished";

export interface GameState {
  status: GameStatus;
  paused: boolean;
  playlistId: string;
  playlistName: string;
  totalRounds: number;
  currentRoundIndex: number;
  currentRound: Round | null;
  score: number;
  scores: Record<string, number>;
  deviceId: string;
  tracks: Track[];
  rounds: RoundResult[];
}

export interface RoundResult {
  trackName: string;
  artists: string[];
  albumArt: string | null;
  guess: string | null;
  correct: boolean;
}

/** Sanitized state sent to the client — hides track info until revealed */
export interface ClientGameState {
  status: GameStatus;
  paused: boolean;
  playlistName: string;
  totalRounds: number;
  currentRoundIndex: number;
  score: number;
  round: {
    phase: RoundPhase;
    guess: string | null;
    correct: boolean | null;
    track: { name: string; artists: string[]; albumArt: string | null } | null;
    buzzedBy: string | null;
  } | null;
  rounds: RoundResult[];
  players: Player[];
  scores: Record<string, number>;
}
