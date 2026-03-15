interface Window {
  onSpotifyWebPlaybackSDKReady: () => void;
  Spotify: typeof Spotify;
}

declare namespace Spotify {
  interface Player {
    connect(): Promise<boolean>;
    disconnect(): void;
    addListener(event: "ready", callback: (data: { device_id: string }) => void): void;
    addListener(event: "not_ready", callback: (data: { device_id: string }) => void): void;
    addListener(event: "player_state_changed", callback: (state: PlaybackState | null) => void): void;
    addListener(event: "initialization_error", callback: (data: { message: string }) => void): void;
    addListener(event: "authentication_error", callback: (data: { message: string }) => void): void;
    addListener(event: "account_error", callback: (data: { message: string }) => void): void;
    removeListener(event: string): void;
    getCurrentState(): Promise<PlaybackState | null>;
    setName(name: string): Promise<void>;
    getVolume(): Promise<number>;
    setVolume(volume: number): Promise<void>;
    pause(): Promise<void>;
    resume(): Promise<void>;
    togglePlay(): Promise<void>;
    seek(position_ms: number): Promise<void>;
    previousTrack(): Promise<void>;
    nextTrack(): Promise<void>;
  }

  interface PlayerInit {
    name: string;
    getOAuthToken: (callback: (token: string) => void) => void;
    volume?: number;
  }

  interface PlaybackState {
    paused: boolean;
    position: number;
    duration: number;
    track_window: {
      current_track: Track;
    };
  }

  interface Track {
    uri: string;
    id: string;
    name: string;
    artists: { name: string; uri: string }[];
    album: {
      name: string;
      uri: string;
      images: { url: string; width: number; height: number }[];
    };
  }

  // Constructor
  var Player: {
    new (options: PlayerInit): Player;
  };
}
