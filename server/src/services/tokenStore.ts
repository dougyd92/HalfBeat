import { config } from "../config.js";

interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

let tokens: Tokens | null = null;

export function setTokens(data: {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}) {
  tokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? tokens?.refreshToken ?? "",
    expiresAt: Date.now() + data.expires_in * 1000 - 60_000, // 60s buffer
  };
}

export function clearTokens() {
  tokens = null;
}

export function isAuthenticated(): boolean {
  return tokens !== null;
}

export async function getAccessToken(): Promise<string> {
  if (!tokens) {
    throw new Error("Not authenticated");
  }

  if (Date.now() >= tokens.expiresAt) {
    await refresh();
  }

  return tokens!.accessToken;
}

async function refresh() {
  if (!tokens) throw new Error("No refresh token available");

  const res = await fetch("https://accounts.spotify.com/api/token", {
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
      grant_type: "refresh_token",
      refresh_token: tokens.refreshToken,
    }),
  });

  if (!res.ok) {
    clearTokens();
    throw new Error(`Token refresh failed: ${res.status}`);
  }

  const data = await res.json();
  setTokens(data);
}
