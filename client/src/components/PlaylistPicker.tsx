import { useEffect, useState } from "react";

interface Playlist {
  id: string;
  name: string;
  imageUrl: string | null;
  trackCount: number;
}

interface Props {
  playlists: Playlist[];
  onFetch: () => void;
  onSelect: (playlistId: string, totalRounds: number) => void;
  loading: boolean;
}

export function PlaylistPicker({ playlists, onFetch, onSelect, loading }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rounds, setRounds] = useState(10);

  useEffect(() => {
    onFetch();
  }, [onFetch]);

  const selected = playlists.find((p) => p.id === selectedId);
  const maxRounds = selected?.trackCount ?? 10;

  return (
    <div className="playlist-picker">
      <h2>Choose a playlist</h2>

      <div className="playlist-list">
        {playlists.map((p) => (
          <button
            key={p.id}
            className={`playlist-card ${selectedId === p.id ? "selected" : ""}`}
            onClick={() => setSelectedId(p.id)}
          >
            {p.imageUrl && (
              <img src={p.imageUrl} alt="" className="playlist-img" />
            )}
            <div className="playlist-info">
              <span className="playlist-name">{p.name}</span>
              <span className="playlist-count">{p.trackCount} tracks</span>
            </div>
          </button>
        ))}
      </div>

      {selectedId && (
        <div className="game-config">
          <label>
            Rounds:{" "}
            <input
              type="number"
              min={1}
              max={maxRounds}
              value={rounds}
              onChange={(e) =>
                setRounds(
                  Math.max(1, Math.min(maxRounds, Number(e.target.value)))
                )
              }
            />
          </label>
          <button
            className="btn btn-primary btn-large"
            disabled={loading}
            onClick={() => onSelect(selectedId, rounds)}
          >
            {loading ? "Starting..." : "Start Game"}
          </button>
        </div>
      )}
    </div>
  );
}
