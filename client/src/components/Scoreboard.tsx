interface RoundResult {
  trackName: string;
  artists: string[];
  albumArt: string | null;
  guess: string | null;
  correct: boolean;
  titleGuessedBy?: string | null;
  artistGuessedBy?: string | null;
  lastChanceResults?: Record<
    string,
    { guess: string; titleCorrect: boolean; artistCorrect: boolean; points: number }
  >;
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

  const formatScore = (s: number) =>
    Number.isInteger(s) ? String(s) : s.toFixed(1);

  return (
    <div className="scoreboard">
      <h2>Game Over</h2>

      {hasPlayers ? (
        <div className="player-scores">
          {sortedPlayers.map(([name, playerScore], i) => (
            <div key={name} className="player-score-row">
              <span className="player-rank">{i + 1}.</span>
              <span className="player-score-name">{name}</span>
              <span className="player-score-value">
                {formatScore(playerScore)} / {totalRounds * 2}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="final-score">
          {formatScore(score)} / {totalRounds * 2}
        </div>
      )}

      <div className="round-results">
        {rounds.map((r, i) => {
          const titleGot = !!r.titleGuessedBy;
          const artistGot = !!r.artistGuessedBy;
          const pts = (titleGot ? 1 : 0) + (artistGot ? 1 : 0);
          // Check for last chance points too
          const lcPoints = r.lastChanceResults
            ? Object.values(r.lastChanceResults).reduce((sum, v) => sum + v.points, 0)
            : 0;
          const totalPts = pts + lcPoints;
          const badgeClass = totalPts >= 2 ? "correct" : totalPts > 0 ? "partial" : "incorrect";

          return (
            <div key={i} className={`result-row ${badgeClass}`}>
              <span className="result-icon">
                {totalPts > 0 ? `+${formatScore(totalPts)}` : "0"}
              </span>
              <div className="result-info">
                <span className="result-track">{r.trackName}</span>
                <span className="result-artist">{r.artists.join(", ")}</span>
                {r.titleGuessedBy && (
                  <span className="result-detail">Title: {r.titleGuessedBy}</span>
                )}
                {r.artistGuessedBy && (
                  <span className="result-detail">Artist: {r.artistGuessedBy}</span>
                )}
                {r.guess && !r.correct && !r.titleGuessedBy && !r.artistGuessedBy && (
                  <span className="result-guess">Guessed: {r.guess}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <button className="btn btn-primary btn-large" onClick={onPlayAgain}>
        Play Again
      </button>
    </div>
  );
}
