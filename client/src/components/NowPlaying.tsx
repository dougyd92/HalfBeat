interface Props {
  trackName: string;
  artistName: string;
  albumArt: string | null;
}

export function NowPlaying({ trackName, artistName, albumArt }: Props) {
  return (
    <div className="now-playing">
      {albumArt && <img src={albumArt} alt="Album art" className="album-art" />}
      <div className="track-info">
        <div className="track-name">{trackName}</div>
        <div className="artist-name">{artistName}</div>
      </div>
    </div>
  );
}
