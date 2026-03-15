interface Props {
  isPlaying: boolean;
  disabled?: boolean;
  onPlay: () => void;
  onPause: () => void;
}

export function PlaybackControls({ isPlaying, disabled, onPlay, onPause }: Props) {
  return (
    <div className="playback-controls">
      {isPlaying ? (
        <button onClick={onPause} disabled={disabled} className="btn btn-large">
          Pause
        </button>
      ) : (
        <button onClick={onPlay} disabled={disabled} className="btn btn-primary btn-large">
          Play
        </button>
      )}
    </div>
  );
}
