# Halfbeat

A multiplayer music quiz game where players identify songs from short Spotify clips, guessing both the song title and artist.

## Quick Start

```bash
cp .env.example .env   # Fill in Spotify credentials
npm install
npm run dev            # Starts server (3001) + client (5173)
```

Host opens `http://localhost:5173/`, players join at `http://localhost:5173/play`.

## Architecture

Monorepo with npm workspaces: `server/` (Express + WebSocket) and `client/` (React + Vite).

```
server/src/
  index.ts              — Express app, HTTP server, WebSocket attach
  config.ts             — Env var loading (.env)
  routes/
    auth.ts             — Spotify OAuth (login, callback, status, token, logout)
    game.ts             — REST endpoints (create, start, guess, pause, resume, reset)
    spotify.ts          — Playback control routes
  services/
    spotify.ts          — Spotify Web API wrapper (playlists, tracks, play/pause)
    tokenStore.ts       — In-memory OAuth token management + auto-refresh
    gameEngine.ts       — Core game state machine (all game logic lives here)
    wsServer.ts         — WebSocket server at /ws, broadcasts state changes
  types/
    game.ts             — All game domain types (Track, Round, GameState, ClientGameState)

client/src/
  App.tsx               — Router: / (Home/host) and /play (Player/remote)
  pages/
    Home.tsx            — Host view: playlist picker, round view, scoreboard
    Player.tsx          — Remote player view: join, buzz, guess, scores
  components/
    RoundView.tsx       — Phase-based round display (used in Home for host/single-player)
    Scoreboard.tsx      — End-game score display
    PlaylistPicker.tsx  — Playlist selection UI
    SpotifyAuth.tsx     — Login/logout button
  hooks/
    useSpotify.ts       — Auth state management
    useSpotifyPlayer.ts — Spotify Web Playback SDK init
    useGame.ts          — Game REST API wrapper (host uses this)
    useWebSocket.ts     — WebSocket connection (players use this)
  api/
    client.ts           — Generic fetch wrapper
```

## Game Flow & State Machine

Each round follows this state machine:

```
createGame → startRound → playClip → PLAYING (10s clip)
  │
  ├─ Player buzzes → GUESSING (15s limit)
  │   ├─ Both title+artist correct → +2 pts, REVEALED
  │   ├─ One correct, single guess → +1 pt, timer +10s, keep guessing
  │   ├─ One correct, attempted both → +1 pt, eliminated, replay for others
  │   ├─ Neither correct → eliminated, replay for others
  │   └─ Timeout → eliminated, replay for others
  │
  ├─ No buzz + players exist → LAST CHANCE (12s, all guess simultaneously)
  │   └─ 0.5 pts per correct piece (title/artist), max 1.0 per player
  │
  └─ No buzz + no players → REVEALED

REVEALED (3s) → next round or FINISHED
```

### Dual-Guess System

Players guess both **song title** and **artist** from a single text box. Max 2 points per track.

**Matching logic** (`evaluateGuess` in gameEngine.ts):
- `fuzzyMatch(input, track.name)` for title, `fuzzyMatch(input, artist)` for each artist
- `fuzzyMatch` normalizes (strips parenthesized text, remaster tags, punctuation) then checks exact match or substring containment (4+ chars)
- If only one piece matches, remaining text after removing the match is checked: ≥2 chars means "attempted both" (eliminated after partial credit), <2 chars means "only guessed one" (keep guessing with +10s)

**Partial reveals**: When a piece is guessed mid-round, the actual title/artist text is broadcast to all players via `revealedName`/`revealedArtists` fields.

### Key Constants (gameEngine.ts)

| Constant | Value | Purpose |
|----------|-------|---------|
| `clipDurationMs` | 10000 | Clip playback length |
| `GUESS_TIME_LIMIT_MS` | 15000 | Time to guess after buzzing |
| `SECOND_GUESS_EXTENSION_MS` | 10000 | Extra time for second piece |
| `WRONG_GUESS_DELAY_MS` | 2000 | Feedback display before transition |
| `ADVANCE_DELAY_MS` | 3000 | Auto-advance between rounds |
| Last Chance timer | 12000 | Time for last chance guessing |

## Communication

**Host** uses REST (`useGame.ts` → `routes/game.ts` → `gameEngine`).
**Players** use WebSocket (`useWebSocket.ts` → `wsServer.ts` → `gameEngine`).

The game engine calls a `broadcastFn` callback on every state change, which wsServer uses to push `gameState` messages to all connected WebSocket clients. The host also receives these broadcasts and syncs via `useWebSocket`.

### WebSocket Messages

| Direction | Type | Purpose |
|-----------|------|---------|
| C→S | `join` | Player joins with name |
| S→C | `joined` | Confirms join with assigned player |
| C→S | `buzz` | Player buzzes in |
| S→C | `buzzResult` | Broadcast buzz outcome |
| C→S | `guess` | Buzzer submits guess |
| C→S | `lastChanceGuess` | Player submits last chance guess |
| S→C | `gameState` | Full state sync (on every change) |
| S→C | `players` | Player list update |

## Spotify Integration

**OAuth 2.0 Authorization Code flow** — credentials in `.env`, tokens stored in-memory (server restart = re-login).

**Scopes**: `streaming`, `user-read-email`, `user-read-private`, `user-modify-playback-state`, `user-read-playback-state`, `user-read-currently-playing`, `playlist-read-private`

Audio plays on the **host machine** via Spotify Web Playback SDK. The server controls playback (play/pause at specific positions) via the Spotify Web API.

## Styling

Plain CSS with CSS custom properties. Dark/light mode via `prefers-color-scheme`. No preprocessor or CSS-in-JS. Spotify green (#1db954) accent. All styles in `index.css` (global) and `App.css` (components).

## Tech Stack

- **Server**: Express 4, ws 8, TypeScript, tsx (runtime)
- **Client**: React 19, Vite 8, react-router-dom 7, TypeScript
- **API**: Spotify Web API + Web Playback SDK
