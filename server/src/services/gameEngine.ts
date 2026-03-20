import * as spotify from "./spotify.js";
import type {
  Track,
  Player,
  GameState,
  ClientGameState,
  Round,
  RoundResult,
  GuessFeedback,
} from "../types/game.js";

let game: GameState | null = null;
let pauseTimer: ReturnType<typeof setTimeout> | null = null;
let advanceTimer: ReturnType<typeof setTimeout> | null = null;
let lastChanceTimer: ReturnType<typeof setTimeout> | null = null;
let guessTimer: ReturnType<typeof setTimeout> | null = null;
let wrongGuessTimer: ReturnType<typeof setTimeout> | null = null;
let players: Player[] = [];
let broadcastFn: (() => void) | null = null;

const ADVANCE_DELAY_MS = 3000;
const GUESS_TIME_LIMIT_MS = 15000;
const WRONG_GUESS_DELAY_MS = 2000;
const SECOND_GUESS_EXTENSION_MS = 10000;

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

function evaluateGuess(
  input: string,
  track: Track,
  titleAlreadyGuessed: boolean,
  artistAlreadyGuessed: boolean
): { titleMatch: boolean; artistMatch: boolean; attemptedBoth: boolean } {
  const titleMatch =
    !titleAlreadyGuessed && fuzzyMatch(input, track.name);
  const artistMatch =
    !artistAlreadyGuessed && track.artists.some((a) => fuzzyMatch(input, a));

  if (titleMatch && artistMatch) {
    return { titleMatch: true, artistMatch: true, attemptedBoth: true };
  }

  if (!titleMatch && !artistMatch) {
    return { titleMatch: false, artistMatch: false, attemptedBoth: false };
  }

  // One matched — check if the remaining text suggests a second guess attempt
  const normalizedInput = normalize(input);
  let matchedText: string;

  if (titleMatch) {
    matchedText = normalize(track.name);
  } else {
    // Find the matching artist (use longest match for best removal)
    const matchingArtists = track.artists
      .filter((a) => fuzzyMatch(input, a))
      .map((a) => normalize(a));
    matchedText = matchingArtists.reduce(
      (longest, a) => (a.length > longest.length ? a : longest),
      ""
    );
  }

  const remaining = normalizedInput.replace(matchedText, "").trim();
  const attemptedBoth = remaining.length >= 2;

  return { titleMatch, artistMatch, attemptedBoth };
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
  if (lastChanceTimer) {
    clearTimeout(lastChanceTimer);
    lastChanceTimer = null;
  }
  if (guessTimer) {
    clearTimeout(guessTimer);
    guessTimer = null;
  }
  if (wrongGuessTimer) {
    clearTimeout(wrongGuessTimer);
    wrongGuessTimer = null;
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
    clipPlayStartedAt: null,
    eliminatedPlayers: [],
    guessDeadline: null,
    lastChanceGuesses: {},
    lastChanceResults: {},
    titleGuessed: false,
    artistGuessed: false,
    titleGuessedBy: null,
    artistGuessedBy: null,
    feedback: null,
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
  round.clipPlayStartedAt = Date.now();
  broadcast();

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
        // Nobody buzzed — give all players a Last Chance to guess
        if (players.length > 0) {
          game.currentRound.phase = "lastChance";
          startLastChanceTimer();
        } else {
          // No players connected — skip to revealed
          game.currentRound.phase = "revealed";
          game.currentRound.guess = null;
          game.currentRound.correct = false;

          game.rounds.push({
            trackName: round.track.name,
            artists: round.track.artists,
            albumArt: round.track.albumArt,
            guess: null,
            correct: false,
            titleGuessedBy: round.titleGuessedBy,
            artistGuessedBy: round.artistGuessedBy,
          });

          if (game.currentRoundIndex >= game.totalRounds - 1) {
            game.status = "finished";
          } else {
            startAdvanceTimer();
          }
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

  // Eliminated players cannot buzz again (Second Chance)
  if (game.currentRound.eliminatedPlayers.includes(player.name)) return false;

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
  game.currentRound.guessDeadline = Date.now() + GUESS_TIME_LIMIT_MS;

  startGuessTimer();
  broadcast();
  return true;
}

// --- Guessing ---

export function submitGuess(guess: string): {
  titleCorrect: boolean;
  artistCorrect: boolean;
  keepGuessing: boolean;
  answer: { name: string; artists: string[]; albumArt: string | null } | null;
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

  if (guessTimer) {
    clearTimeout(guessTimer);
    guessTimer = null;
  }

  const round = game.currentRound;
  const result = evaluateGuess(
    guess,
    round.track,
    round.titleGuessed,
    round.artistGuessed
  );

  const pointsAwarded =
    (result.titleMatch ? 1 : 0) + (result.artistMatch ? 1 : 0);

  // Award points
  if (pointsAwarded > 0) {
    game.score += pointsAwarded;
    if (round.buzzedBy && game.scores[round.buzzedBy] !== undefined) {
      game.scores[round.buzzedBy] += pointsAwarded;
    }
    if (result.titleMatch) {
      round.titleGuessed = true;
      round.titleGuessedBy = round.buzzedBy;
    }
    if (result.artistMatch) {
      round.artistGuessed = true;
      round.artistGuessedBy = round.buzzedBy;
    }
  }

  const allGuessed = round.titleGuessed && round.artistGuessed;

  // CASE 1: Both correct (or all remaining pieces correct) — reveal
  if (allGuessed) {
    round.guess = guess;
    round.correct = true;
    round.feedback = {
      titleCorrect: result.titleMatch,
      artistCorrect: result.artistMatch,
      keepGuessing: false,
    };
    round.phase = "revealed";

    game.rounds.push({
      trackName: round.track.name,
      artists: round.track.artists,
      albumArt: round.track.albumArt,
      guess,
      correct: true,
      titleGuessedBy: round.titleGuessedBy,
      artistGuessedBy: round.artistGuessedBy,
    });

    if (game.currentRoundIndex >= game.totalRounds - 1) {
      game.status = "finished";
    } else {
      startAdvanceTimer();
    }

    broadcast();
    return {
      titleCorrect: result.titleMatch,
      artistCorrect: result.artistMatch,
      keepGuessing: false,
      answer: {
        name: round.track.name,
        artists: round.track.artists,
        albumArt: round.track.albumArt,
      },
    };
  }

  // CASE 2: One correct, attempted both — partial credit + eliminate
  if (pointsAwarded > 0 && result.attemptedBoth) {
    round.guess = guess;
    round.correct = false;
    round.feedback = {
      titleCorrect: result.titleMatch,
      artistCorrect: result.artistMatch,
      keepGuessing: false,
    };
    broadcast();

    wrongGuessTimer = setTimeout(() => {
      wrongGuessTimer = null;
      if (!game?.currentRound || game.currentRound !== round) return;

      if (round.buzzedBy) {
        round.eliminatedPlayers.push(round.buzzedBy);
      }

      transitionAfterWrongGuess(round);
    }, WRONG_GUESS_DELAY_MS);

    return {
      titleCorrect: result.titleMatch,
      artistCorrect: result.artistMatch,
      keepGuessing: false,
      answer: null,
    };
  }

  // CASE 3: One correct, only guessed one thing — keep guessing with timer extension
  if (pointsAwarded > 0 && !result.attemptedBoth) {
    round.guess = guess;
    round.correct = null; // not fully resolved yet
    round.feedback = {
      titleCorrect: result.titleMatch,
      artistCorrect: result.artistMatch,
      keepGuessing: true,
    };
    round.guessDeadline = Date.now() + SECOND_GUESS_EXTENSION_MS;
    startGuessTimer(SECOND_GUESS_EXTENSION_MS);
    broadcast();

    return {
      titleCorrect: result.titleMatch,
      artistCorrect: result.artistMatch,
      keepGuessing: true,
      answer: null,
    };
  }

  // CASE 4: Neither correct — wrong guess, eliminate
  round.guess = guess;
  round.correct = false;
  round.feedback = {
    titleCorrect: false,
    artistCorrect: false,
    keepGuessing: false,
  };
  broadcast();

  wrongGuessTimer = setTimeout(() => {
    wrongGuessTimer = null;
    if (!game?.currentRound || game.currentRound !== round) return;

    if (round.buzzedBy) {
      round.eliminatedPlayers.push(round.buzzedBy);
    }

    transitionAfterWrongGuess(round);
  }, WRONG_GUESS_DELAY_MS);

  return {
    titleCorrect: false,
    artistCorrect: false,
    keepGuessing: false,
    answer: null,
  };
}

function transitionAfterWrongGuess(round: Round): void {
  const eligiblePlayers = players.filter(
    (p) => !round.eliminatedPlayers.includes(p.name)
  );

  if (eligiblePlayers.length > 0) {
    round.buzzedBy = null;
    round.guess = null;
    round.correct = null;
    round.feedback = null;
    round.phase = "playing";

    playClip(); // async fire-and-forget
  } else {
    round.buzzedBy = null;
    round.guess = null;
    round.correct = null;
    round.feedback = null;
    round.phase = "lastChance";

    startLastChanceTimer();
  }

  broadcast();
}

// --- Guess Timer ---

function startGuessTimer(durationMs: number = GUESS_TIME_LIMIT_MS): void {
  if (guessTimer) clearTimeout(guessTimer);
  guessTimer = setTimeout(() => {
    guessTimer = null;
    if (!game?.currentRound || game.currentRound.phase !== "guessing") return;
    handleGuessTimeout();
  }, durationMs);
}

function handleGuessTimeout(): void {
  if (!game?.currentRound) return;
  const round = game.currentRound;

  // Treat timeout as a wrong guess — show feedback, then transition after delay
  round.guess = null;
  round.correct = false;
  round.feedback = null;
  // Keep buzzedBy intact so UI knows who timed out
  broadcast();

  wrongGuessTimer = setTimeout(() => {
    wrongGuessTimer = null;
    if (!game?.currentRound || game.currentRound !== round) return;

    if (round.buzzedBy) {
      round.eliminatedPlayers.push(round.buzzedBy);
    }

    transitionAfterWrongGuess(round);
  }, WRONG_GUESS_DELAY_MS);
}

function startWrongGuessTimer(): void {
  if (wrongGuessTimer) clearTimeout(wrongGuessTimer);
  wrongGuessTimer = setTimeout(() => {
    wrongGuessTimer = null;
    if (!game?.currentRound || game.currentRound.phase !== "guessing") return;
    const round = game.currentRound;

    if (round.buzzedBy) {
      round.eliminatedPlayers.push(round.buzzedBy);
    }

    transitionAfterWrongGuess(round);
  }, WRONG_GUESS_DELAY_MS);
}

// --- Last Chance ---

function startLastChanceTimer(): void {
  if (lastChanceTimer) clearTimeout(lastChanceTimer);
  lastChanceTimer = setTimeout(() => {
    lastChanceTimer = null;
    if (!game?.currentRound || game.currentRound.phase !== "lastChance") return;
    resolveLastChance();
  }, 12000);
}

export function submitLastChanceGuess(playerName: string, guess: string): void {
  if (!game?.currentRound || game.currentRound.phase !== "lastChance") return;
  const round = game.currentRound;

  // Only one guess per player
  if (round.lastChanceGuesses[playerName] !== undefined) return;

  round.lastChanceGuesses[playerName] = guess;

  // Evaluate against remaining unguessed pieces
  const result = evaluateGuess(
    guess,
    round.track,
    round.titleGuessed,
    round.artistGuessed
  );
  round.lastChanceResults[playerName] = {
    titleCorrect: result.titleMatch,
    artistCorrect: result.artistMatch,
  };

  broadcast();

  // Check if all connected players have submitted
  const allSubmitted = players.every(
    (p) => round.lastChanceGuesses[p.name] !== undefined
  );
  if (allSubmitted) {
    resolveLastChance();
  }
}

function resolveLastChance(): void {
  if (lastChanceTimer) {
    clearTimeout(lastChanceTimer);
    lastChanceTimer = null;
  }
  if (!game?.currentRound) return;
  const round = game.currentRound;

  // Award 0.5 points per correct piece in last-chance guesses
  let anyCorrect = false;
  for (const [name, result] of Object.entries(round.lastChanceResults)) {
    const points =
      (result.titleCorrect ? 0.5 : 0) + (result.artistCorrect ? 0.5 : 0);
    if (points > 0) {
      game.scores[name] = (game.scores[name] ?? 0) + points;
      anyCorrect = true;
    }
    if (result.titleCorrect) round.titleGuessed = true;
    if (result.artistCorrect) round.artistGuessed = true;
  }

  round.phase = "revealed";
  round.correct = anyCorrect;

  game.rounds.push({
    trackName: round.track.name,
    artists: round.track.artists,
    albumArt: round.track.albumArt,
    guess: null,
    correct: anyCorrect,
    titleGuessedBy: round.titleGuessedBy,
    artistGuessedBy: round.artistGuessedBy,
    lastChanceResults: Object.fromEntries(
      Object.entries(round.lastChanceGuesses).map(([name, guess]) => {
        const r = round.lastChanceResults[name];
        const points =
          (r?.titleCorrect ? 0.5 : 0) + (r?.artistCorrect ? 0.5 : 0);
        return [
          name,
          {
            guess,
            titleCorrect: r?.titleCorrect ?? false,
            artistCorrect: r?.artistCorrect ?? false,
            points,
          },
        ];
      })
    ),
  });

  if (game.currentRoundIndex >= game.totalRounds - 1) {
    game.status = "finished";
  } else {
    startAdvanceTimer();
  }

  broadcast();
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
  if (lastChanceTimer) {
    clearTimeout(lastChanceTimer);
    lastChanceTimer = null;
  }
  if (guessTimer) {
    clearTimeout(guessTimer);
    guessTimer = null;
  }
  if (wrongGuessTimer) {
    clearTimeout(wrongGuessTimer);
    wrongGuessTimer = null;
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
    } else if (game.currentRound.phase === "guessing" && game.currentRound.correct === false) {
      // Was showing wrong-guess feedback — restart the delay timer
      startWrongGuessTimer();
    } else if (game.currentRound.phase === "guessing") {
      // Restart the guess timer
      startGuessTimer();
    } else if (game.currentRound.phase === "lastChance") {
      // Restart the last chance timer
      startLastChanceTimer();
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
      clipPlayStartedAt: round.clipPlayStartedAt,
      clipDurationMs: round.clipDurationMs,
      eliminatedPlayers: round.eliminatedPlayers,
      guessDeadline: round.guessDeadline,
      lastChanceSubmitted: Object.keys(round.lastChanceGuesses),
      // Only reveal guesses/results after the round is resolved
      lastChanceGuesses: showTrack ? round.lastChanceGuesses : {},
      lastChanceResults: showTrack ? round.lastChanceResults : {},
      titleGuessed: round.titleGuessed,
      artistGuessed: round.artistGuessed,
      titleGuessedBy: round.titleGuessedBy,
      artistGuessedBy: round.artistGuessedBy,
      feedback: round.feedback,
      revealedName: round.titleGuessed ? round.track.name : null,
      revealedArtists: round.artistGuessed ? round.track.artists : null,
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
  if (lastChanceTimer) {
    clearTimeout(lastChanceTimer);
    lastChanceTimer = null;
  }
  if (guessTimer) {
    clearTimeout(guessTimer);
    guessTimer = null;
  }
  if (wrongGuessTimer) {
    clearTimeout(wrongGuessTimer);
    wrongGuessTimer = null;
  }
  game = null;
  broadcast();
}
