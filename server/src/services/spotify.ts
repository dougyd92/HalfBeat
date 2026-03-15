import { getAccessToken } from "./tokenStore.js";

const BASE = "https://api.spotify.com/v1";

async function spotifyFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  return res;
}

export async function getProfile() {
  const res = await spotifyFetch("/me");
  if (!res.ok) throw new Error(`Spotify /me failed: ${res.status}`);
  return res.json();
}

export async function getPlaybackState() {
  const res = await spotifyFetch("/me/player");
  if (res.status === 204) return null; // no active playback
  if (!res.ok) throw new Error(`Spotify /player failed: ${res.status}`);
  return res.json();
}

export async function play(options?: {
  uris?: string[];
  position_ms?: number;
  device_id?: string;
}) {
  const params = options?.device_id
    ? `?device_id=${options.device_id}`
    : "";

  const body: Record<string, unknown> = {};
  if (options?.uris) body.uris = options.uris;
  if (options?.position_ms !== undefined) body.position_ms = options.position_ms;

  const maxRetries = 2;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await spotifyFetch(`/me/player/play${params}`, {
      method: "PUT",
      body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
    });

    if (res.ok) return;

    // Retry on transient errors
    if ((res.status === 502 || res.status === 503 || res.status === 429) && attempt < maxRetries) {
      const delay = res.status === 429
        ? parseInt(res.headers.get("Retry-After") ?? "1", 10) * 1000
        : 1000;
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    const text = await res.text();
    throw new Error(`Spotify play failed: ${res.status} ${text}`);
  }
}

export async function getUserPlaylists(): Promise<
  { id: string; name: string; imageUrl: string | null; trackCount: number }[]
> {
  const res = await spotifyFetch("/me/playlists?limit=50");
  if (!res.ok) throw new Error(`Spotify /me/playlists failed: ${res.status}`);
  const data = await res.json();
  return data.items
    .filter((p: { id?: string }) => p != null && p.id != null)
    .map(
      (p: {
        id: string;
        name: string;
        images: { url: string }[];
        items: { total: number };
      }) => ({
        id: p.id,
        name: p.name,
        imageUrl: p.images?.[0]?.url ?? null,
        trackCount: p.items?.total ?? 0,
      })
  );
}

export async function getPlaylistTracks(
  playlistId: string
): Promise<
  {
    uri: string;
    name: string;
    artists: string[];
    albumArt: string | null;
    durationMs: number;
    isLocal: boolean;
  }[]
> {
  type TrackItem = {
    uri: string;
    name: string;
    artists: string[];
    albumArt: string | null;
    durationMs: number;
    isLocal: boolean;
  };
  const tracks: TrackItem[] = [];

  // Use /playlists/{id} to get tracks embedded in the playlist response
  const res = await spotifyFetch(`/playlists/${playlistId}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Spotify playlist failed: ${res.status} ${body}`);
  }
  const playlist = await res.json();
  function extractTracks(items: unknown[]) {
    for (const entry of items) {
      const e = entry as { item?: unknown; is_local?: boolean };
      const t = e.item as {
        uri: string;
        name: string;
        artists: { name: string }[];
        album?: { images?: { url: string }[] };
        duration_ms: number;
      } | null;
      if (!t) continue;
      const isLocal = e.is_local ?? false;
      tracks.push({
        uri: t.uri,
        name: t.name,
        artists: t.artists.map((a) => a.name),
        albumArt: t.album?.images?.[0]?.url ?? null,
        durationMs: t.duration_ms,
        isLocal,
      });
    }
  }

  // First batch comes from the playlist object
  // playlist.items is a paging object with { items: [], next, total, ... }
  extractTracks(playlist.items.items);

  // Fetch remaining pages if playlist has more than 100 tracks
  let nextUrl: string | null = playlist.items.next;
  while (nextUrl) {
    const pageRes = await spotifyFetch(
      nextUrl.replace("https://api.spotify.com/v1", "")
    );
    if (!pageRes.ok) break;
    const page = await pageRes.json();
    extractTracks(page.items);
    nextUrl = page.next;
  }

  return tracks;
}

export async function pause(deviceId?: string) {
  const params = deviceId ? `?device_id=${deviceId}` : "";
  const res = await spotifyFetch(`/me/player/pause${params}`, {
    method: "PUT",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify pause failed: ${res.status} ${text}`);
  }
}
