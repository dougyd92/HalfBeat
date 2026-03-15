import { useState, useEffect, useRef } from "react";
import { api } from "../api/client";

export function useSpotifyPlayer(isAuthenticated: boolean) {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const playerRef = useRef<Spotify.Player | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Load the SDK script
    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    document.body.appendChild(script);

    window.onSpotifyWebPlaybackSDKReady = () => {
      const player = new window.Spotify.Player({
        name: "Halfbeat",
        getOAuthToken: async (cb) => {
          try {
            const data = await api<{ access_token: string }>("/auth/token");
            cb(data.access_token);
          } catch {
            setError("Failed to get token for player");
          }
        },
        volume: 0.5,
      });

      player.addListener("ready", ({ device_id }) => {
        console.log("Halfbeat player ready, device ID:", device_id);
        setDeviceId(device_id);
        setIsReady(true);
        setError(null);
      });

      player.addListener("not_ready", () => {
        setIsReady(false);
        setDeviceId(null);
      });

      player.addListener("initialization_error", ({ message }) => {
        setError(`Player init error: ${message}`);
      });

      player.addListener("authentication_error", ({ message }) => {
        setError(`Auth error: ${message}`);
      });

      player.addListener("account_error", ({ message }) => {
        setError(`Account error: ${message}. Spotify Premium required.`);
      });

      player.connect();
      playerRef.current = player;
    };

    return () => {
      playerRef.current?.disconnect();
      playerRef.current = null;
      setDeviceId(null);
      setIsReady(false);
      document.body.removeChild(script);
    };
  }, [isAuthenticated]);

  return { deviceId, isReady, error, player: playerRef.current };
}
