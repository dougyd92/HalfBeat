interface Props {
  isAuthenticated: boolean;
  userName: string | null;
  onLogin: () => void;
  onLogout: () => void;
}

export function SpotifyAuth({
  isAuthenticated,
  userName,
  onLogin,
  onLogout,
}: Props) {
  if (isAuthenticated) {
    return (
      <div className="auth-status">
        <span className="auth-connected">Connected as {userName}</span>
        <button onClick={onLogout} className="btn btn-small">
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button onClick={onLogin} className="btn btn-primary btn-large">
      Connect to Spotify
    </button>
  );
}
