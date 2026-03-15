interface RoundResult {
  trackName: string;
  artists: string[];
  albumArt: string | null;
  guess: string | null;
  correct: boolean;
}

interface Props {
  score: number;
  totalRounds: number;
  rounds: RoundResult[];
  scores: Record<string, number>;
  onPlayAgain: () => void;
}

export function Scoreboard({ score, totalRounds, rounds, scores, onPlayAgain }: Props) {
  const sortedPlayers = Object.entries(scores).sort(([, a], [, b]) => b - a);
  const hasPlayers = sortedPlayers.length > 0;

  return (
    <div className="scoreboard">
      <h2>Game Over</h2>

      {hasPlayers ? (
        <div className="player-scores">
          {sortedPlayers.map(([name, playerScore], i) => (
            <div key={name} className="player-score-row">
              <span className="player-rank">{i + 1}.</span>
              <span className="player-score-name">{name}</span>
              <span className="player-score-value">{playerScore}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="final-score">
          {score} / {totalRounds}
        </div>
      )}

      <div className="round-results">
        {rounds.map((r, i) => (
          <div key={i} className={`result-row ${r.correct ? "correct" : "incorrect"}`}>
            <span className="result-icon">{r.correct ? "+" : "-"}</span>
            <div className="result-info">
              <span className="result-track">{r.trackName}</span>
              <span className="result-artist">{r.artists.join(", ")}</span>
              {r.guess && !r.correct && (
                <span className="result-guess">Guessed: {r.guess}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <button className="btn btn-primary btn-large" onClick={onPlayAgain}>
        Play Again
      </button>
    </div>
  );
}
