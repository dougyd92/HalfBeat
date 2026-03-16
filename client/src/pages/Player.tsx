import { useState, useEffect } from "react";
import { useWebSocket } from "../hooks/useWebSocket";

export function Player() {
  const {
    connected,
    player,
    players,
    gameState,
    buzzResult,
    join,
    buzz,
    guess: sendGuess,
    lastChanceGuess: sendLastChanceGuess,
  } = useWebSocket();
  const [nameInput, setNameInput] = useState("");
  const [guessInput, setGuessInput] = useState("");
  const [lastChanceInput, setLastChanceInput] = useState("");
  const [countdown, setCountdown] = useState(3);
  const [remaining, setRemaining] = useState(1);
  const [lastChanceCountdown, setLastChanceCountdown] = useState(8);
  const [guessCountdown, setGuessCountdown] = useState<number | null>(null);

  const round = gameState?.round;
  const isRevealed = round?.phase === "revealed";
  const isPaused = gameState?.paused ?? false;
  const isLastRound =
    gameState != null &&
    gameState.currentRoundIndex >= gameState.totalRounds - 1;

  // Clip timer countdown
  useEffect(() => {
    if (
      round?.phase !== "playing" ||
      isPaused ||
      !round.clipPlayStartedAt ||
      !round.clipDurationMs
    ) {
      setRemaining(1);
      return;
    }

    const { clipPlayStartedAt, clipDurationMs } = round;
    const interval = setInterval(() => {
      const elapsed = Date.now() - clipPlayStartedAt;
      const frac = Math.max(0, (clipDurationMs - elapsed) / clipDurationMs);
      setRemaining(frac);
    }, 100);

    return () => clearInterval(interval);
  }, [round?.phase, isPaused, round?.clipPlayStartedAt, round?.clipDurationMs]);

  // Guess timer countdown
  useEffect(() => {
    const deadline = round?.guessDeadline;
    if (round?.phase !== "guessing" || !deadline) {
      setGuessCountdown(null);
      return;
    }

    const tick = () => {
      const secs = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setGuessCountdown(secs);
    };
    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [round?.phase, round?.guessDeadline]);

  // Last Chance 8-second countdown
  useEffect(() => {
    if (round?.phase !== "lastChance") {
      setLastChanceCountdown(8);
      setLastChanceInput("");
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
  }, [round?.phase, gameState?.currentRoundIndex]);

  // Revealed countdown
  useEffect(() => {
    if (!isRevealed || isLastRound || isPaused) {
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
  }, [isRevealed, isLastRound, isPaused, gameState?.currentRoundIndex]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const name = nameInput.trim();
    if (name) join(name);
  };

  const handleGuess = (e: React.FormEvent) => {
    e.preventDefault();
    const text = guessInput.trim();
    if (text) {
      sendGuess(text);
      setGuessInput("");
    }
  };

  const handleLastChanceGuess = (e: React.FormEvent) => {
    e.preventDefault();
    const text = lastChanceInput.trim();
    if (text) {
      sendLastChanceGuess(text);
      setLastChanceInput("");
    }
  };

  // Not connected yet
  if (!connected) {
    return (
      <div className="player-page">
        <h1>Halfbeat</h1>
        <p className="player-status">Connecting...</p>
      </div>
    );
  }

  // Not joined yet — show name entry
  if (!player) {
    return (
      <div className="player-page">
        <h1>Halfbeat</h1>
        <form className="join-form" onSubmit={handleJoin}>
          <input
            className="guess-input"
            type="text"
            placeholder="Your name"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            autoFocus
            maxLength={20}
          />
          <button
            className="btn btn-primary"
            type="submit"
            disabled={!nameInput.trim()}
          >
            Join
          </button>
        </form>
      </div>
    );
  }

  // Joined — show game view
  const isPlaying = round?.phase === "playing";
  const isGuessing = round?.phase === "guessing";
  const isLastChance = round?.phase === "lastChance";
  const iBuzzed = buzzResult?.success && buzzResult.player.id === player.id;
  const someoneBuzzed = round?.buzzedBy != null;
  const isEliminated =
    round?.eliminatedPlayers?.includes(player.name) ?? false;
  const hasSubmittedLastChance =
    round?.lastChanceSubmitted?.includes(player.name) ?? false;
  const scores = gameState?.scores ?? {};
  const sortedPlayers = Object.entries(scores).sort(([, a], [, b]) => b - a);

  const formatScore = (s: number) =>
    Number.isInteger(s) ? String(s) : s.toFixed(1);

  const secondsLeft = round?.clipDurationMs
    ? Math.ceil(remaining * (round.clipDurationMs / 1000))
    : 0;

  return (
    <div className="player-page">
      <h1>Halfbeat</h1>
      <p className="player-joined">
        Playing as <strong>{player.name}</strong>
      </p>

      {players.length > 0 && (
        <div className="player-list">
          {players.map((p) => (
            <span
              key={p.id}
              className={`player-tag ${p.id === player.id ? "you" : ""}`}
            >
              {p.name}
              {scores[p.name] !== undefined && (
                <span className="tag-score">{formatScore(scores[p.name])}</span>
              )}
            </span>
          ))}
        </div>
      )}

      {!gameState && (
        <div className="waiting-message">
          <p>Waiting for host to start a game...</p>
        </div>
      )}

      {gameState && !round && gameState.status === "active" && (
        <div className="waiting-message">
          <p>Get ready! Next round starting soon...</p>
        </div>
      )}

      {isPlaying && !isPaused && !isEliminated && (
        <div className="buzz-section">
          <div
            className="clip-timer"
            style={{ "--remaining": remaining } as React.CSSProperties}
          >
            <span className="clip-timer-text">{secondsLeft}</span>
          </div>
          <p>
            Round {(gameState?.currentRoundIndex ?? 0) + 1} of{" "}
            {gameState?.totalRounds}
          </p>
          <button className="btn buzz-btn" onClick={buzz}>
            BUZZ
          </button>
        </div>
      )}

      {isPlaying && !isPaused && isEliminated && (
        <div className="buzz-section">
          <div
            className="clip-timer"
            style={{ "--remaining": remaining } as React.CSSProperties}
          >
            <span className="clip-timer-text">{secondsLeft}</span>
          </div>
          <div className="eliminated-message">
            <p>You already guessed this round</p>
            <p className="waiting-text">Waiting for other players...</p>
          </div>
        </div>
      )}

      {isPlaying && isPaused && (
        <div className="buzz-section">
          <p className="countdown-text paused-text">Paused</p>
        </div>
      )}

      {isGuessing && (
        <div className="buzz-result-section">
          {iBuzzed && round?.correct === false ? (
            <p className="buzz-feedback incorrect">
              {round?.guess != null ? "Wrong!" : "Time's up!"}
            </p>
          ) : iBuzzed ? (
            <>
              <p className="buzz-feedback you-buzzed">You buzzed in! {guessCountdown != null && `(${guessCountdown}s)`}</p>
              <form onSubmit={handleGuess} className="guess-form">
                <input
                  type="text"
                  value={guessInput}
                  onChange={(e) => setGuessInput(e.target.value)}
                  placeholder="What song is it?"
                  autoFocus
                  className="guess-input"
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!guessInput.trim()}
                >
                  Guess
                </button>
              </form>
            </>
          ) : someoneBuzzed ? (
            <p className="buzz-feedback someone-buzzed">
              {round?.buzzedBy} buzzed in {guessCountdown != null && `(${guessCountdown}s)`}
            </p>
          ) : (
            <p className="buzz-feedback">Time's up!</p>
          )}
        </div>
      )}

      {isLastChance && (
        <div className="last-chance-section">
          <p className="last-chance-title">Last Chance!</p>
          {!hasSubmittedLastChance ? (
            <>
              <p>Quick — guess the song! ({lastChanceCountdown}s)</p>
              <form onSubmit={handleLastChanceGuess} className="guess-form">
                <input
                  type="text"
                  value={lastChanceInput}
                  onChange={(e) => setLastChanceInput(e.target.value)}
                  placeholder="What song is it?"
                  autoFocus
                  className="guess-input"
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!lastChanceInput.trim()}
                >
                  Guess
                </button>
              </form>
            </>
          ) : (
            <p className="last-chance-submitted">
              Guess submitted! Waiting for others... ({lastChanceCountdown}s)
            </p>
          )}
        </div>
      )}

      {isRevealed && round?.track && (
        <div className="round-reveal-player">
          <div className="result-badge-player">
            {round.correct ? (
              <span className="correct">Correct!</span>
            ) : (
              <span className="incorrect">Not quite</span>
            )}
          </div>
          <div className="revealed-track">
            {round.track.albumArt && (
              <img className="album-art" src={round.track.albumArt} alt="" />
            )}
            <div className="track-details">
              <span className="track-name">{round.track.name}</span>
              <span className="artist-name">
                {round.track.artists.join(", ")}
              </span>
            </div>
          </div>
          {Object.keys(round.lastChanceResults ?? {}).length > 0 && (
            <div className="last-chance-reveal">
              {Object.entries(round.lastChanceGuesses ?? {}).map(
                ([name, guess]) => (
                  <p
                    key={name}
                    className={
                      round.lastChanceResults?.[name]
                        ? "lc-correct"
                        : "lc-incorrect"
                    }
                  >
                    {name}: "{guess}"{" "}
                    {round.lastChanceResults?.[name] ? "(+0.5)" : ""}
                  </p>
                )
              )}
            </div>
          )}
          {!isLastRound && !isPaused && (
            <p className="countdown-text">Next round in {countdown}...</p>
          )}
          {isPaused && !isLastRound && (
            <p className="countdown-text paused-text">Paused</p>
          )}
        </div>
      )}

      {gameState?.status === "finished" && (
        <div className="game-over-player">
          <h2>Game Over!</h2>
          <div className="player-scores">
            {sortedPlayers.map(([name, playerScore], i) => (
              <div key={name} className="player-score-row">
                <span className="player-rank">{i + 1}.</span>
                <span className="player-score-name">{name}</span>
                <span className="player-score-value">
                  {formatScore(playerScore)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
