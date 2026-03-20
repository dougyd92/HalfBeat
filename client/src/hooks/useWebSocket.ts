import { useState, useEffect, useRef, useCallback } from "react";

interface Player {
  id: string;
  name: string;
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

interface GameState {
  status: "active" | "finished";
  paused: boolean;
  playlistName: string;
  totalRounds: number;
  currentRoundIndex: number;
  score: number;
  round: {
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
  } | null;
  rounds: RoundResult[];
  players: Player[];
  scores: Record<string, number>;
}

interface UseWebSocketReturn {
  connected: boolean;
  player: Player | null;
  players: Player[];
  gameState: GameState | null;
  buzzResult: { player: Player; success: boolean } | null;
  join: (name: string) => void;
  buzz: () => void;
  guess: (text: string) => void;
  lastChanceGuess: (text: string) => void;
}

export function useWebSocket(): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [player, setPlayer] = useState<Player | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [buzzResult, setBuzzResult] = useState<{
    player: Player;
    success: boolean;
  } | null>(null);

  useEffect(() => {
    // Connect directly to backend port to avoid Vite proxy issues
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.hostname}:3001/ws`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        case "joined":
          setPlayer(msg.player);
          break;
        case "players":
          setPlayers(msg.players);
          break;
        case "gameState":
          setGameState(msg.state);
          break;
        case "buzzResult":
          setBuzzResult({ player: msg.player, success: msg.success });
          break;
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  const join = useCallback((name: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "join", name }));
    }
  }, []);

  const buzz = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "buzz" }));
    }
  }, []);

  const guess = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "guess", guess: text }));
    }
  }, []);

  const lastChanceGuess = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ type: "lastChanceGuess", guess: text })
      );
    }
  }, []);

  return {
    connected,
    player,
    players,
    gameState,
    buzzResult,
    join,
    buzz,
    guess,
    lastChanceGuess,
  };
}
