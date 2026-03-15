import { Router } from "express";
import * as spotify from "../services/spotify.js";

const router = Router();

router.get("/playback", async (_req, res) => {
  try {
    const data = await spotify.getPlaybackState();
    res.json(data);
  } catch (err) {
    console.error("Get playback error:", err);
    res.status(500).json({ error: "Failed to get playback state" });
  }
});

router.post("/play", async (req, res) => {
  try {
    await spotify.play(req.body);
    res.json({ ok: true });
  } catch (err) {
    console.error("Play error:", err);
    res.status(500).json({ error: "Failed to start playback" });
  }
});

router.post("/pause", async (req, res) => {
  try {
    await spotify.pause(req.body.device_id);
    res.json({ ok: true });
  } catch (err) {
    console.error("Pause error:", err);
    res.status(500).json({ error: "Failed to pause playback" });
  }
});

export default router;
