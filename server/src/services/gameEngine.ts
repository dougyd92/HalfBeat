import * as spotify from "./spotify.js";
import type {
  Track,
  Player,
  GameState,
  ClientGameState,
  Round,
  RoundResult,
} from "../types/game.js";

let game: GameState | null = null;
let pauseTimer: ReturnType<typeof setTimeout> | null = null;
let advanceTimer: ReturnType<typeof setTimeout> | null = null;
let players: Player[] = [];
let broadcastFn: (() => void) | null = null;

const ADVANCE_DELAY_MS = 3000;

/** Register a callback that fires whenever game state changes */
export function setBroadcast(fn: () => void): void {
  broadcastFn = fn;
}

function broadcast(): void {
  broadcastFn?.();
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Strip parenthesized suffixes, remaster tags, punctuation, then lowercase */
function normalize(s: string): string {
  return s
    .replace(/\(.*?\)/g, "") // (feat. ...), (Remastered), etc.
    .replace(/\[.*?\]/g, "") // [Deluxe Edition], etc.
    .replace(/\s*-\s*(remaster|remastered|remix|live|bonus|deluxe|mono|stereo).*/i, "")
    .replace(/[^\w\s]/g, "") // strip punctuation
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function fuzzyMatch(guess: string, trackName: string): boolean {
  const g = normalize(guess);
  const t = normalize(trackName);

  if (!g) return false;
  if (g === t) return true;
  if (g.length >= 4 && t.includes(g)) return true;
  if (t.length >= 4 && g.includes(t)) return true;
  return false;
}

// --- Player management ---

export function addPlayer(player: Player): void {
  players.push(player);
  if (game) {
    game.scores[player.name] = game.scores[player.name] ?? 0;
  }
  broadcast();
}

export function removePlayer(playerId: string): void {
  players = players.filter((p) => p.id !== playerId);
  broadcast();
}

export function getPlayers(): Player[] {
  return [...players];
}

// --- Game lifecycle ---

export async function createGame(
  playlistId: string,
  deviceId: string,
  totalRounds: number = 10
): Promise<ClientGameState> {
  // Clear any pending timers from a previous game
  if (pauseTimer) {
    clearTimeout(pauseTimer);
    pauseTimer = null;
  }
  if (advanceTimer) {
    clearTimeout(advanceTimer);
    advanceTimer = null;
  }

  const rawTracks = await spotify.getPlaylistTracks(playlistId);

  // Filter out unplayable tracks
  const playable = rawTracks.filter((t) => !t.isLocal && t.durationMs >= 5000);

  if (playable.length === 0) {
    throw new Error("This playlist has no playable tracks. Try another.");
  }

  const tracks: Track[] = playable.map((t) => ({
    uri: t.uri,
    name: t.name,
    artists: t.artists,
    albumArt: t.albumArt,
    durationMs: t.durationMs,
  }));

  const shuffled = shuffle(tracks);
  const rounds = Math.min(totalRounds, shuffled.length);

  // Get playlist name
  const playlists = await spotify.getUserPlaylists();
  const playlist = playlists.find((p) => p.id === playlistId);

  game = {
    status: "active",
    paused: false,
    playlistId,
    playlistName: playlist?.name ?? "Unknown Playlist",
    totalRounds: rounds,
    currentRoundIndex: -1,
    currentRound: null,
    score: 0,
    scores: Object.fromEntries(players.map((p) => [p.name, 0])),
    deviceId,
    tracks: shuffled,
    rounds: [],
  };

  const state = getState();
  broadcast();
  return state;
}

export function startRound(): ClientGameState {
  if (!game || game.status !== "active") {
    throw new Error("No active game");
  }

  // Clear any pending advance timer
  if (advanceTimer) {
    clearTimeout(advanceTimer);
    advanceTimer = null;
  }

  const nextIndex = game.currentRoundIndex + 1;
  if (nextIndex >= game.totalRounds) {
    throw new Error("All rounds completed");
  }

  const track = game.tracks[nextIndex];
  const clipDurationMs = 10000;
  const maxStart = Math.max(0, track.durationMs - clipDurationMs - 500);
  const clipStartMs = Math.floor(Math.random() * maxStart);

  game.currentRoundIndex = nextIndex;
  game.currentRound = {
    index: nextIndex,
    track,
    clipStartMs,
    clipDurationMs,
    phase: "playing",
    guess: null,
    correct: null,
    buzzedBy: null,
  };

  const state = getState();
  broadcast();
  return state;
}

export async function playClip(): Promise<void> {
  if (!game || !game.currentRound) {
    throw new Error("No active round");
  }

  const round = game.currentRound;

  // Clear any existing pause timer
  if (pauseTimer) {
    clearTimeout(pauseTimer);
    pauseTimer = null;
  }

  await spotify.play({
    uris: [round.track.uri],
    position_ms: round.clipStartMs,
    device_id: game.deviceId,
  });

  round.phase = "playing";

  // Auto-pause after clip duration
  pauseTimer = setTimeout(async () => {
    try {
      await spotify.pause(game?.deviceId);
    } catch {
      // Not critical — worst case the song keeps playing
    }
    if (game?.currentRound && game.currentRound.index === round.index) {
      if (game.currentRound.buzzedBy) {
        // Someone buzzed — let them guess
        game.currentRound.phase = "guessing";
      } else {
        // Nobody buzzed — skip straight to revealed (no points)
        game.currentRound.phase = "revealed";
        game.currentRound.guess = null;
        game.currentRound.correct = false;

        game.rounds.push({
          trackName: round.track.name,
          artists: round.track.artists,
          albumArt: round.track.albumArt,
          guess: null,
          correct: false,
        });

        if (game.currentRoundIndex >= game.totalRounds - 1) {
          game.status = "finished";
        } else {
          startAdvanceTimer();
        }
      }
      broadcast();
    }
    pauseTimer = null;
  }, round.clipDurationMs);
}

export async function replayClip(): Promise<void> {
  if (!game || !game.currentRound) {
    throw new Error("No active round");
  }
  if (game.currentRound.phase === "revealed") {
    throw new Error("Round already revealed");
  }
  await playClip();
  broadcast();
}

// --- Buzz-in ---

export async function handleBuzz(playerId: string): Promise<boolean> {
  if (!game || !game.currentRound || game.currentRound.phase !== "playing") {
    return false;
  }

  const player = players.find((p) => p.id === playerId);
  if (!player) return false;

  // Clear the auto-pause timer
  if (pauseTimer) {
    clearTimeout(pauseTimer);
    pauseTimer = null;
  }

  // Pause Spotify
  try {
    await spotify.pause(game.deviceId);
  } catch {
    // Not critical — continue with the buzz even if pause fails
  }

  // Update round
  game.currentRound.buzzedBy = player.name;
  game.currentRound.phase = "guessing";

  broadcast();
  return true;
}

// --- Guessing ---

export function submitGuess(guess: string): {
  correct: boolean;
  answer: { name: string; artists: string[]; albumArt: string | null };
} {
  if (!game || !game.currentRound) {
    throw new Error("No active round");
  }
  if (game.currentRound.phase !== "guessing") {
    throw new Error(
      game.currentRound.phase === "revealed"
        ? "Round already revealed"
        : "Clip is still playing"
    );
  }

  const round = game.currentRound;
  const correct = fuzzyMatch(guess, round.track.name);

  round.guess = guess;
  round.correct = correct;
  round.phase = "revealed";

  if (correct) {
    game.score++;
    if (round.buzzedBy && game.scores[round.buzzedBy] !== undefined) {
      game.scores[round.buzzedBy]++;
    }
  }

  // Record round result
  game.rounds.push({
    trackName: round.track.name,
    artists: round.track.artists,
    albumArt: round.track.albumArt,
    guess,
    correct,
  });

  // Check if game is finished
  if (game.currentRoundIndex >= game.totalRounds - 1) {
    game.status = "finished";
  } else {
    startAdvanceTimer();
  }

  const result = {
    correct,
    answer: {
      name: round.track.name,
      artists: round.track.artists,
      albumArt: round.track.albumArt,
    },
  };

  broadcast();
  return result;
}

// --- Auto-advance ---

function startAdvanceTimer(): void {
  if (advanceTimer) {
    clearTimeout(advanceTimer);
  }
  advanceTimer = setTimeout(async () => {
    advanceTimer = null;
    if (!game || game.status !== "active") return;
    try {
      startRound();
      await playClip();
    } catch {
      // Round start failed — game may have ended
    }
  }, ADVANCE_DELAY_MS);
}

// --- Pause / Resume ---

export async function pauseGame(): Promise<void> {
  if (!game || game.status !== "active") {
    throw new Error("No active game");
  }

  game.paused = true;

  // Clear all timers
  if (pauseTimer) {
    clearTimeout(pauseTimer);
    pauseTimer = null;
  }
  if (advanceTimer) {
    clearTimeout(advanceTimer);
    advanceTimer = null;
  }

  // Pause Spotify
  try {
    await spotify.pause(game.deviceId);
  } catch {
    // Not critical
  }

  broadcast();
}

export async function resumeGame(): Promise<void> {
  if (!game || game.status !== "active") {
    throw new Error("No active game");
  }
  if (!game.paused) return;

  game.paused = false;

  if (game.currentRound) {
    if (game.currentRound.phase === "playing") {
      // Replay the clip
      await playClip();
    } else if (game.currentRound.phase === "revealed") {
      // Restart the advance timer
      if (game.currentRoundIndex < game.totalRounds - 1) {
        startAdvanceTimer();
      }
    }
  }

  broadcast();
}

// --- State ---

export function getState(): ClientGameState {
  if (!game) {
    throw new Error("No game in progress");
  }

  const round = game.currentRound;
  let roundView: ClientGameState["round"] = null;

  if (round) {
    const showTrack = round.phase === "revealed";
    roundView = {
      phase: round.phase,
      guess: round.guess,
      correct: round.correct,
      track: showTrack
        ? {
            name: round.track.name,
            artists: round.track.artists,
            albumArt: round.track.albumArt,
          }
        : null,
      buzzedBy: round.buzzedBy,
    };
  }

  return {
    status: game.status,
    paused: game.paused,
    playlistName: game.playlistName,
    totalRounds: game.totalRounds,
    currentRoundIndex: game.currentRoundIndex,
    score: game.score,
    round: roundView,
    rounds: game.rounds,
    players,
    scores: game.scores,
  };
}

export function hasGame(): boolean {
  return game !== null;
}

export function resetGame(): void {
  if (pauseTimer) {
    clearTimeout(pauseTimer);
    pauseTimer = null;
  }
  if (advanceTimer) {
    clearTimeout(advanceTimer);
    advanceTimer = null;
  }
  game = null;
  broadcast();
}
