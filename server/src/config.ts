import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    console.error("Copy .env.example to .env and fill in your Spotify credentials.");
    process.exit(1);
  }
  return value;
}

export const config = {
  clientId: requireEnv("SPOTIFY_CLIENT_ID"),
  clientSecret: requireEnv("SPOTIFY_CLIENT_SECRET"),
  redirectUri: requireEnv("SPOTIFY_REDIRECT_URI"),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  port: parseInt(process.env.PORT || "3001", 10),
};
