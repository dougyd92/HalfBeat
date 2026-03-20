import { useEffect } from "react";
import { useSpotify } from "../hooks/useSpotify";
import { useSpotifyPlayer } from "../hooks/useSpotifyPlayer";
import { useGame } from "../hooks/useGame";
import { useWebSocket } from "../hooks/useWebSocket";
import { SpotifyAuth } from "../components/SpotifyAuth";
import { PlaylistPicker } from "../components/PlaylistPicker";
import { RoundView } from "../components/RoundView";
import { Scoreboard } from "../components/Scoreboard";

export function Home() {
  const { isAuthenticated, user, error: authError, login, logout } =
    useSpotify();

  const {
    deviceId,
    isReady: playerReady,
    error: playerError,
  } = useSpotifyPlayer(isAuthenticated);

  const {
    playlists,
    gameState,
    setGameState,
    error: gameError,
    loading,
    fetchPlaylists,
    createGame,
    startRound,
    replayClip,
    submitGuess,
    pauseGame,
    resumeGame,
    resetGame,
  } = useGame();

  const {
    players: wsPlayers,
    gameState: wsGameState,
  } = useWebSocket();

  // Sync WebSocket game state to useGame state
  useEffect(() => {
    if (wsGameState) {
      setGameState(wsGameState);
    }
  }, [wsGameState, setGameState]);

  const displayError = authError || playerError || gameError;
  const hasPlayers = wsPlayers.length > 0;

  const handleSelect = (playlistId: string, totalRounds: number) => {
    if (deviceId) {
      createGame(playlistId, deviceId, totalRounds);
    }
  };

  const handleGuess = async (guess: string) => {
    await submitGuess(guess);
  };

  const buzzedBy = gameState?.round?.buzzedBy ?? null;
  const scores = gameState?.scores ?? {};
  const isPaused = gameState?.paused ?? false;

  return (
    <div className="home">
      <h1>Halfbeat</h1>

      <SpotifyAuth
        isAuthenticated={isAuthenticated}
        userName={user?.display_name ?? null}
        onLogin={login}
        onLogout={logout}
      />

      {displayError && <p className="error">{displayError}</p>}

      {isAuthenticated && (
        <div className="connected-players">
          <span className="players-label">Players:</span>
          {wsPlayers.length > 0 ? (
            wsPlayers.map((p) => (
              <span key={p.id} className="player-tag">{p.name}</span>
            ))
          ) : (
            <span className="no-players">None yet</span>
          )}
        </div>
      )}

      {isAuthenticated && !playerReady && (
        <p className="player-status">Initializing player...</p>
      )}

      {isAuthenticated && playerReady && !gameState && (
        <PlaylistPicker
          playlists={playlists}
          onFetch={fetchPlaylists}
          onSelect={handleSelect}
          loading={loading}
        />
      )}

      {gameState?.status === "active" && gameState.round && (
        <>
          {buzzedBy && gameState.round.phase !== "playing" && (
            <p className="buzzed-by">{buzzedBy} buzzed in!</p>
          )}
          <RoundView
            roundIndex={gameState.currentRoundIndex}
            totalRounds={gameState.totalRounds}
            phase={gameState.round.phase}
            guess={gameState.round.guess}
            correct={gameState.round.correct}
            track={gameState.round.track}
            score={gameState.score}
            buzzedBy={buzzedBy}
            paused={isPaused}
            onReplay={replayClip}
            onGuess={hasPlayers ? undefined : handleGuess}
            isLastRound={gameState.currentRoundIndex >= gameState.totalRounds - 1}
            clipPlayStartedAt={gameState.round.clipPlayStartedAt}
            clipDurationMs={gameState.round.clipDurationMs}
            eliminatedPlayers={gameState.round.eliminatedPlayers}
            guessDeadline={gameState.round.guessDeadline}
            lastChanceSubmitted={gameState.round.lastChanceSubmitted}
            titleGuessed={gameState.round.titleGuessed}
            artistGuessed={gameState.round.artistGuessed}
            titleGuessedBy={gameState.round.titleGuessedBy}
            artistGuessedBy={gameState.round.artistGuessedBy}
            feedback={gameState.round.feedback}
            revealedName={gameState.round.revealedName}
            revealedArtists={gameState.round.revealedArtists}
          />
        </>
      )}

      {gameState?.status === "active" && !gameState.round && (
        <div className="game-start">
          <p>Playing: {gameState.playlistName}</p>
          <button className="btn btn-primary btn-large" onClick={startRound}>
            Start First Round
          </button>
        </div>
      )}

      {gameState?.status === "active" && (
        <div className="game-controls">
          {isPaused ? (
            <button className="btn btn-control btn-resume" onClick={resumeGame}>
              Resume
            </button>
          ) : (
            <button className="btn btn-control btn-pause" onClick={pauseGame}>
              Pause
            </button>
          )}
          <button className="btn btn-control btn-restart" onClick={resetGame}>
            Restart
          </button>
        </div>
      )}

      {gameState?.status === "finished" && (
        <Scoreboard
          score={gameState.score}
          totalRounds={gameState.totalRounds}
          rounds={gameState.rounds}
          scores={scores}
          onPlayAgain={resetGame}
        />
      )}
    </div>
  );
}
