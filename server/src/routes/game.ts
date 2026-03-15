import { Router } from "express";
import * as spotify from "../services/spotify.js";
import * as gameEngine from "../services/gameEngine.js";

const router = Router();

router.get("/playlists", async (_req, res) => {
  try {
    const playlists = await spotify.getUserPlaylists();
    res.json(playlists);
  } catch (err) {
    console.error("Get playlists error:", err);
    res.status(500).json({ error: "Failed to get playlists" });
  }
});

router.post("/create", async (req, res) => {
  try {
    const { playlistId, deviceId, totalRounds } = req.body;
    const state = await gameEngine.createGame(playlistId, deviceId, totalRounds);
    res.json(state);
  } catch (err) {
    console.error("Create game error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to create game";
    res.status(400).json({ error: message });
  }
});

router.get("/state", (_req, res) => {
  try {
    if (!gameEngine.hasGame()) {
      res.json(null);
      return;
    }
    const state = gameEngine.getState();
    res.json(state);
  } catch (err) {
    console.error("Get state error:", err);
    res.status(500).json({ error: "Failed to get game state" });
  }
});

router.post("/round/start", async (_req, res) => {
  try {
    gameEngine.startRound();
    await gameEngine.playClip();
    const state = gameEngine.getState();
    res.json(state);
  } catch (err) {
    console.error("Start round error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to start round";
    res.status(400).json({ error: message });
  }
});

router.post("/round/replay", async (_req, res) => {
  try {
    await gameEngine.replayClip();
    res.json({ ok: true });
  } catch (err) {
    console.error("Replay error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to replay clip";
    res.status(400).json({ error: message });
  }
});

router.post("/round/guess", (req, res) => {
  try {
    const { guess } = req.body;
    const result = gameEngine.submitGuess(guess);
    res.json(result);
  } catch (err) {
    console.error("Guess error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to submit guess";
    res.status(400).json({ error: message });
  }
});

router.post("/pause", async (_req, res) => {
  try {
    await gameEngine.pauseGame();
    res.json({ ok: true });
  } catch (err) {
    console.error("Pause error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to pause game";
    res.status(400).json({ error: message });
  }
});

router.post("/resume", async (_req, res) => {
  try {
    await gameEngine.resumeGame();
    res.json({ ok: true });
  } catch (err) {
    console.error("Resume error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to resume game";
    res.status(400).json({ error: message });
  }
});

router.post("/reset", (_req, res) => {
  gameEngine.resetGame();
  res.json({ ok: true });
});

export default router;
