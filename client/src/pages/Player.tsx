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
  } = useWebSocket();
  const [nameInput, setNameInput] = useState("");
  const [guessInput, setGuessInput] = useState("");
  const [countdown, setCountdown] = useState(3);

  const round = gameState?.round;
  const isRevealed = round?.phase === "revealed";
  const isPaused = gameState?.paused ?? false;
  const isLastRound =
    gameState != null &&
    gameState.currentRoundIndex >= gameState.totalRounds - 1;

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
  const iBuzzed = buzzResult?.success && buzzResult.player.id === player.id;
  const someoneBuzzed = round?.buzzedBy != null;
  const scores = gameState?.scores ?? {};
  const sortedPlayers = Object.entries(scores).sort(([, a], [, b]) => b - a);

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
                <span className="tag-score">{scores[p.name]}</span>
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

      {isPlaying && (
        <div className="buzz-section">
          <div className="listening-indicator">
            <span className="listening-dot" />
            <span className="listening-dot" />
            <span className="listening-dot" />
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

      {isGuessing && (
        <div className="buzz-result-section">
          {iBuzzed ? (
            <>
              <p className="buzz-feedback you-buzzed">You buzzed in!</p>
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
              {round?.buzzedBy} buzzed in
            </p>
          ) : (
            <p className="buzz-feedback">Time's up!</p>
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
                <span className="player-score-value">{playerScore}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
