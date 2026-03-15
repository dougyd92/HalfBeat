import { Router } from "express";
import crypto from "crypto";
import { config } from "../config.js";
import { setTokens, clearTokens, isAuthenticated, getAccessToken } from "../services/tokenStore.js";
import { getProfile } from "../services/spotify.js";

const router = Router();

let storedState: string | null = null;

const SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-modify-playback-state",
  "user-read-playback-state",
  "user-read-currently-playing",
  "playlist-read-private",
].join(" ");

router.get("/login", (_req, res) => {
  storedState = crypto.randomBytes(16).toString("hex");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    scope: SCOPES,
    redirect_uri: config.redirectUri,
    state: storedState,
  });
  res.redirect(`https://accounts.spotify.com/authorize?${params}`);
});

router.get("/callback", async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`${config.frontendUrl}?error=${error}`);
  }

  if (state !== storedState) {
    return res.redirect(`${config.frontendUrl}?error=state_mismatch`);
  }

  storedState = null;

  try {
    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(`${config.clientId}:${config.clientSecret}`).toString(
            "base64"
          ),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code as string,
        redirect_uri: config.redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      console.error("Token exchange failed:", text);
      return res.redirect(`${config.frontendUrl}?error=token_exchange_failed`);
    }

    const data = await tokenRes.json();
    setTokens(data);
    res.redirect(config.frontendUrl);
  } catch (err) {
    console.error("Auth callback error:", err);
    res.redirect(`${config.frontendUrl}?error=server_error`);
  }
});

router.get("/status", async (_req, res) => {
  if (!isAuthenticated()) {
    return res.json({ authenticated: false });
  }

  try {
    const profile = await getProfile();
    res.json({
      authenticated: true,
      user: {
        display_name: profile.display_name,
        id: profile.id,
      },
    });
  } catch {
    res.json({ authenticated: false });
  }
});

router.get("/token", async (_req, res) => {
  if (!isAuthenticated()) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const token = await getAccessToken();
    res.json({ access_token: token });
  } catch {
    res.status(401).json({ error: "Token unavailable" });
  }
});

router.post("/logout", (_req, res) => {
  clearTokens();
  res.json({ ok: true });
});

export default router;
