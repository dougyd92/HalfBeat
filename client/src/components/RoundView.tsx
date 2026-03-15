import { useState, useEffect, type FormEvent } from "react";

interface RoundViewProps {
  roundIndex: number;
  totalRounds: number;
  phase: "playing" | "guessing" | "revealed";
  guess: string | null;
  correct: boolean | null;
  track: { name: string; artists: string[]; albumArt: string | null } | null;
  score: number;
  buzzedBy: string | null;
  paused: boolean;
  onReplay: () => void;
  onGuess?: (guess: string) => void;
  isLastRound: boolean;
}

export function RoundView({
  roundIndex,
  totalRounds,
  phase,
  correct,
  track,
  score,
  buzzedBy,
  paused,
  onReplay,
  onGuess,
  isLastRound,
}: RoundViewProps) {
  const [guessText, setGuessText] = useState("");
  const [countdown, setCountdown] = useState(3);

  // Visual countdown when revealed (non-last round)
  useEffect(() => {
    if (phase !== "revealed" || isLastRound || paused) {
      setCountdown(3);
      return;
    }

    setCountdown(3);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [phase, isLastRound, paused, roundIndex]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (guessText.trim() && onGuess) {
      onGuess(guessText.trim());
      setGuessText("");
    }
  };

  return (
    <div className="round-view">
      <div className="round-header">
        <span className="round-number">
          Round {roundIndex + 1} / {totalRounds}
        </span>
        <span className="round-score">
          {score} / {roundIndex + (phase === "revealed" ? 1 : 0)} correct
        </span>
      </div>

      {phase === "playing" && (
        <div className="round-playing">
          <div className="listening-indicator">
            <span className="listening-dot" />
            <span className="listening-dot" />
            <span className="listening-dot" />
          </div>
          <p>Listening...</p>
        </div>
      )}

      {phase === "guessing" && (
        <div className="round-guessing">
          {buzzedBy ? (
            <p>Waiting for <strong>{buzzedBy}</strong> to guess...</p>
          ) : onGuess ? (
            <>
              <p>What song was that?</p>
              <form onSubmit={handleSubmit} className="guess-form">
                <input
                  type="text"
                  value={guessText}
                  onChange={(e) => setGuessText(e.target.value)}
                  placeholder="Type your guess..."
                  autoFocus
                  className="guess-input"
                />
                <button type="submit" className="btn btn-primary" disabled={!guessText.trim()}>
                  Guess
                </button>
              </form>
              <button className="btn btn-small" onClick={onReplay}>
                Replay clip
              </button>
            </>
          ) : (
            <p>Time's up!</p>
          )}
        </div>
      )}

      {phase === "revealed" && track && (
        <div className="round-revealed">
          <div className={`result-badge ${correct ? "correct" : "incorrect"}`}>
            {correct ? "Correct!" : "Not quite"}
          </div>

          <div className="revealed-track">
            {track.albumArt && (
              <img src={track.albumArt} alt="" className="album-art" />
            )}
            <div className="track-details">
              <span className="track-name">{track.name}</span>
              <span className="artist-name">{track.artists.join(", ")}</span>
            </div>
          </div>

          {!isLastRound && !paused && (
            <p className="countdown-text">Next round in {countdown}...</p>
          )}
          {paused && !isLastRound && (
            <p className="countdown-text paused-text">Paused</p>
          )}
        </div>
      )}
    </div>
  );
}
