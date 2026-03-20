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

export type RoundPhase = "playing" | "guessing" | "revealed" | "lastChance";

export interface Round {
  index: number;
  track: Track;
  clipStartMs: number;
  clipDurationMs: number;
  phase: RoundPhase;
  guess: string | null;
  correct: boolean | null;
  buzzedBy: string | null;
  clipPlayStartedAt: number | null;
  eliminatedPlayers: string[];
  guessDeadline: number | null;
  lastChanceGuesses: Record<string, string>;
  lastChanceResults: Record<string, LastChancePlayerResult>;
  titleGuessed: boolean;
  artistGuessed: boolean;
  titleGuessedBy: string | null;
  artistGuessedBy: string | null;
  feedback: GuessFeedback | null;
}

export interface GuessFeedback {
  titleCorrect: boolean;
  artistCorrect: boolean;
  keepGuessing: boolean;
}

export interface LastChancePlayerResult {
  titleCorrect: boolean;
  artistCorrect: boolean;
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
  titleGuessedBy: string | null;
  artistGuessedBy: string | null;
  lastChanceResults?: Record<
    string,
    { guess: string; titleCorrect: boolean; artistCorrect: boolean; points: number }
  >;
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
    clipPlayStartedAt: number | null;
    clipDurationMs: number;
    eliminatedPlayers: string[];
    guessDeadline: number | null;
    lastChanceSubmitted: string[];
    lastChanceGuesses: Record<string, string>;
    lastChanceResults: Record<string, LastChancePlayerResult>;
    titleGuessed: boolean;
    artistGuessed: boolean;
    titleGuessedBy: string | null;
    artistGuessedBy: string | null;
    feedback: GuessFeedback | null;
    /** Song title, revealed to all when titleGuessed is true (before full reveal) */
    revealedName: string | null;
    /** Artist names, revealed to all when artistGuessed is true (before full reveal) */
    revealedArtists: string[] | null;
  } | null;
  rounds: RoundResult[];
  players: Player[];
  scores: Record<string, number>;
}
