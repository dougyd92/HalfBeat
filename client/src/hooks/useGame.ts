import { useState, useCallback } from "react";
import { api } from "../api/client";

interface Playlist {
  id: string;
  name: string;
  imageUrl: string | null;
  trackCount: number;
}

interface GuessFeedback {
  titleCorrect: boolean;
  artistCorrect: boolean;
  keepGuessing: boolean;
}

interface LastChancePlayerResult {
  titleCorrect: boolean;
  artistCorrect: boolean;
}

interface RoundView {
  phase: "playing" | "guessing" | "revealed" | "lastChance";
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
  revealedName: string | null;
  revealedArtists: string[] | null;
}

interface RoundResult {
  trackName: string;
  artists: string[];
  albumArt: string | null;
  guess: string | null;
  correct: boolean;
  titleGuessedBy?: string | null;
  artistGuessedBy?: string | null;
  lastChanceResults?: Record<
    string,
    { guess: string; titleCorrect: boolean; artistCorrect: boolean; points: number }
  >;
}

interface PlayerInfo {
  id: string;
  name: string;
}

interface GameState {
  status: "active" | "finished";
  paused: boolean;
  playlistName: string;
  totalRounds: number;
  currentRoundIndex: number;
  score: number;
  round: RoundView | null;
  rounds: RoundResult[];
  players: PlayerInfo[];
  scores: Record<string, number>;
}

export function useGame() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchPlaylists = useCallback(async () => {
    setError(null);
    try {
      const data = await api<Playlist[]>("/game/playlists");
      setPlaylists(data);
    } catch {
      setError("Failed to load playlists.");
    }
  }, []);

  const createGame = useCallback(
    async (playlistId: string, deviceId: string, totalRounds?: number) => {
      setError(null);
      setLoading(true);
      try {
        const state = await api<GameState>("/game/create", {
          method: "POST",
          body: { playlistId, deviceId, totalRounds },
        });
        setGameState(state);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to create game.";
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const startRound = useCallback(async () => {
    setError(null);
    try {
      const state = await api<GameState>("/game/round/start", {
        method: "POST",
      });
      setGameState(state);
    } catch {
      setError("Failed to start round.");
    }
  }, []);

  const replayClip = useCallback(async () => {
    setError(null);
    try {
      await api("/game/round/replay", { method: "POST" });
      const state = await api<GameState>("/game/state");
      if (state) setGameState(state);
    } catch {
      setError("Failed to replay clip.");
    }
  }, []);

  const submitGuess = useCallback(async (guess: string) => {
    setError(null);
    try {
      await api("/game/round/guess", {
        method: "POST",
        body: { guess },
      });
      const state = await api<GameState>("/game/state");
      if (state) setGameState(state);
    } catch {
      setError("Failed to submit guess.");
    }
  }, []);

  const pauseGame = useCallback(async () => {
    setError(null);
    try {
      await api("/game/pause", { method: "POST" });
      const state = await api<GameState>("/game/state");
      if (state) setGameState(state);
    } catch {
      setError("Failed to pause game.");
    }
  }, []);

  const resumeGame = useCallback(async () => {
    setError(null);
    try {
      await api("/game/resume", { method: "POST" });
      const state = await api<GameState>("/game/state");
      if (state) setGameState(state);
    } catch {
      setError("Failed to resume game.");
    }
  }, []);

  const resetGame = useCallback(async () => {
    setError(null);
    try {
      await api("/game/reset", { method: "POST" });
      setGameState(null);
    } catch {
      setError("Failed to reset game.");
    }
  }, []);

  return {
    playlists,
    gameState,
    setGameState,
    error,
    loading,
    fetchPlaylists,
    createGame,
    startRound,
    replayClip,
    submitGuess,
    pauseGame,
    resumeGame,
    resetGame,
  };
}
