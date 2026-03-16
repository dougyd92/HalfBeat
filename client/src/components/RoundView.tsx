import { useState, useEffect, type FormEvent } from "react";

interface RoundViewProps {
  roundIndex: number;
  totalRounds: number;
  phase: "playing" | "guessing" | "revealed" | "lastChance";
  guess: string | null;
  correct: boolean | null;
  track: { name: string; artists: string[]; albumArt: string | null } | null;
  score: number;
  buzzedBy: string | null;
  paused: boolean;
  onReplay: () => void;
  onGuess?: (guess: string) => void;
  isLastRound: boolean;
  clipPlayStartedAt: number | null;
  clipDurationMs: number;
  eliminatedPlayers: string[];
  guessDeadline: number | null;
  lastChanceSubmitted: string[];
}

export function RoundView({
  roundIndex,
  totalRounds,
  phase,
  guess,
  correct,
  track,
  score,
  buzzedBy,
  paused,
  onReplay,
  onGuess,
  isLastRound,
  clipPlayStartedAt,
  clipDurationMs,
  eliminatedPlayers,
  guessDeadline,
  lastChanceSubmitted,
}: RoundViewProps) {
  const [guessText, setGuessText] = useState("");
  const [countdown, setCountdown] = useState(3);
  const [remaining, setRemaining] = useState(1);
  const [lastChanceCountdown, setLastChanceCountdown] = useState(8);
  const [guessCountdown, setGuessCountdown] = useState<number | null>(null);

  // Clip timer countdown
  useEffect(() => {
    if (phase !== "playing" || paused || !clipPlayStartedAt || !clipDurationMs) {
      setRemaining(1);
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Date.now() - clipPlayStartedAt;
      const frac = Math.max(0, (clipDurationMs - elapsed) / clipDurationMs);
      setRemaining(frac);
    }, 100);

    return () => clearInterval(interval);
  }, [phase, paused, clipPlayStartedAt, clipDurationMs]);

  // Guess timer countdown
  useEffect(() => {
    if (phase !== "guessing" || !guessDeadline) {
      setGuessCountdown(null);
      return;
    }

    const tick = () => {
      const secs = Math.max(0, Math.ceil((guessDeadline - Date.now()) / 1000));
      setGuessCountdown(secs);
    };
    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [phase, guessDeadline]);

  // Last Chance 8-second countdown
  useEffect(() => {
    if (phase !== "lastChance") {
      setLastChanceCountdown(8);
      return;
    }

    setLastChanceCountdown(8);
    const interval = setInterval(() => {
      setLastChanceCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [phase, roundIndex]);

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

  const secondsLeft = Math.ceil(remaining * (clipDurationMs / 1000));

  return (
    <div className="round-view">
      <div className="round-header">
        <span className="round-number">
          Round {roundIndex + 1} / {totalRounds}
        </span>
        <span className="round-score">
          {Number.isInteger(score) ? score : score.toFixed(1)} /{" "}
          {roundIndex + (phase === "revealed" ? 1 : 0)} correct
        </span>
      </div>

      {phase === "playing" && (
        <div className="round-playing">
          {!paused && (
            <>
              <div
                className="clip-timer"
                style={
                  { "--remaining": remaining } as React.CSSProperties
                }
              >
                <span className="clip-timer-text">{secondsLeft}</span>
              </div>
              <div className="listening-indicator">
                <span className="listening-dot" />
                <span className="listening-dot" />
                <span className="listening-dot" />
              </div>
              <p>Listening...</p>
            </>
          )}
          {paused && (
            <p className="countdown-text paused-text">Paused</p>
          )}
          {eliminatedPlayers.length > 0 && (
            <p className="eliminated-names">
              Out: {eliminatedPlayers.join(", ")}
            </p>
          )}
        </div>
      )}

      {phase === "guessing" && (
        <div className="round-guessing">
          {buzzedBy && correct === false ? (
            <p className="wrong-guess-feedback">
              <strong>{buzzedBy}</strong> {guess != null ? "guessed wrong" : "ran out of time"}
            </p>
          ) : buzzedBy ? (
            <p>Waiting for <strong>{buzzedBy}</strong> to guess... {guessCountdown != null && `(${guessCountdown}s)`}</p>
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

      {phase === "lastChance" && (
        <div className="round-last-chance">
          <p className="last-chance-title">Last Chance!</p>
          <p>Players are guessing... ({lastChanceCountdown}s)</p>
          {lastChanceSubmitted.length > 0 && (
            <p className="last-chance-submitted">
              Submitted: {lastChanceSubmitted.join(", ")}
            </p>
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
