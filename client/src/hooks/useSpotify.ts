import { useState, useEffect } from "react";
import { api } from "../api/client";

interface User {
  display_name: string;
  id: string;
}

interface PlaybackState {
  is_playing: boolean;
  progress_ms: number;
  item: {
    name: string;
    artists: { name: string }[];
    album: {
      name: string;
      images: { url: string; width: number; height: number }[];
    };
  } | null;
}

export function useSpotify() {
  const [user, setUser] = useState<User | null>(null);
  const [playback, setPlayback] = useState<PlaybackState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = user !== null;

  // Check auth status on mount
  useEffect(() => {
    api<{ authenticated: boolean; user?: User }>("/auth/status").then(
      (data) => {
        if (data.authenticated && data.user) {
          setUser(data.user);
        }
      }
    );
  }, []);

  // Poll playback state every 2s when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    const poll = () => {
      api<PlaybackState | null>("/spotify/playback")
        .then(setPlayback)
        .catch(() => {});
    };

    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const login = () => {
    window.location.href = "/auth/login";
  };

  const logout = async () => {
    await api("/auth/logout", { method: "POST" });
    setUser(null);
    setPlayback(null);
  };

  const play = async (deviceId?: string) => {
    setError(null);
    try {
      await api("/spotify/play", {
        method: "POST",
        body: deviceId ? { device_id: deviceId } : {},
      });
    } catch {
      setError("Failed to play.");
    }
  };

  const pause = async (deviceId?: string) => {
    setError(null);
    try {
      await api("/spotify/pause", {
        method: "POST",
        body: deviceId ? { device_id: deviceId } : {},
      });
    } catch {
      setError("Failed to pause.");
    }
  };

  return {
    isAuthenticated,
    user,
    playback,
    error,
    login,
    logout,
    play,
    pause,
  };
}
