# Music App: Downloads, Desktop UI, Unified Playlist Layout

I extracted and read the uploaded `yt-dlp-get-pot` repo. Important finding: it is a **Python yt-dlp client-side plugin framework only** — it contains no token generator, and its README now marks it deprecated (yt-dlp has a built-in PO token framework). It cannot run in this app (Deno edge functions + browser). So instead of installing it, I ported the same idea that its provider plugins use (BotGuard PO tokens) to this stack, and I already proved it works end to end in the sandbox:

- Minted `visitorData` from `youtube.com/sw.js_data` — OK
- Ran a BotGuard challenge and minted an integrity token — OK
- Generated a real PO token (848 chars) — OK
- InnerTube player call with PO token + `signatureTimestamp` returned `status: OK` with 26 formats
- Direct audio stream fetch returned HTTP 206 with real bytes

Key insight about the current 502s: the server IP is what YouTube blocks, not the request shape. So the token is minted **in the user's browser** (real DOM, real IP), and the media bytes are also fetched **from the browser**, with the edge function only used for URL resolution and as a proxy fallback.

## Task 1 — PO token download engine (works without any cookie)

- `src/services/poTokenProvider.ts`: browser-side provider using `bgutils-js`. Mints `visitorData` + PO token, caches it in memory/localStorage with TTL, refreshes on expiry, exposes `getPoToken()`.
- `supabase/functions/_shared/ytresolve.ts`: accept `poToken` + `visitorData` from the caller; add `signatureTimestamp` (scraped from `player_ias.vflset` base.js, cached) to the player payload; order clients `ANDROID_VR` → `IOS` → `TVHTML5` → `WEB`; return direct progressive/adaptive audio + video URLs. Keep `YT_COOKIE` as an optional extra, no longer required.
- `supabase/functions/public-download/index.ts`: `?mode=resolve` returns stream URLs + headers to the browser; existing proxy mode stays as fallback with range support.
- `src/services/downloadService.ts`: new flow — mint token → resolve → fetch bytes directly in the browser with ranged fetch and progress → on CORS/403 failure, retry through the edge proxy → on failure, next itag/client. Clear toasts, never a fatal runtime error.

## Task 2 — Offline library

- Save downloaded audio blobs in IndexedDB (`downloads` store: id, title, artist, artwork, mime, size, blob) plus a metadata index.
- Player resolves a local blob URL first when a track is downloaded, so playback works fully offline.
- Downloads page/section lists saved songs with size, delete, and play; green check on downloaded rows in album/playlist lists.

## Task 3 — Homepage + player fixes

- `QuickAccessGrid.tsx`: "Recently Listened" becomes exactly **8 cards, 2 across × 4 down**, filled from real listen history (padded with Deezer recommendations when history is short).
- "Watch video" button on the player: opens the synced muted video panel over the audio track, seek-synced both ways, with a clean close control.
- Keep empty rows hidden; all cards keep working Deezer artwork/metadata.

## Task 4 — Full desktop layout (matches the uploaded screenshots)

Responsive shell at `lg:` and up, mobile untouched:

```text
+----------+---------------------------------+------------+
|  Sidebar |  Top bar: back/fwd, search      | Now Playing|
|  Home    |---------------------------------|  artwork   |
|  Search  |  Content (Good morning grid,    |  title     |
|  Library |  album/playlist detail)         |  lyrics    |
|  ...     |                                 |  queue     |
+----------+---------------------------------+------------+
|            Bottom playback bar (full width)             |
+--------------------------------------------------------+
```

- `AppLayout.tsx`: three-pane grid on desktop; `BottomNav` + `MiniPlayer` on mobile only.
- New `DesktopSidebar` (nav + "Your Library" list), `DesktopTopBar` (nav arrows, home, "What do you want to play?" search, profile), `DesktopNowPlayingPanel`, `DesktopPlayerBar` (progress, volume, shuffle/repeat, queue/lyrics/video toggles).
- Home on desktop: greeting grid + wide card rows as in the screenshot.
- Album/playlist detail on desktop: gradient hero, large art, Play + Download + more, and a **table tracklist** (#, title with thumbnail, album, date added, duration).

## Task 5 — One playlist layout everywhere + spacing fix

- Make `AlbumDetail`'s layout the single shared detail layout (`src/components/detail/DetailPage.tsx`) and rewrite `PlaylistDetail.tsx`, `UserPlaylistDetail.tsx`, `LikedSongs.tsx`, and `RecentlyPlayed.tsx` on top of it, so every playlist in the app (including from Library, Search, Discover, Radio) uses the album design.
- Library playlist rows/cards restyled to match.
- Remove the dead space under the album/playlist tracklist (bottom padding now exactly clears the player bar, nothing more).

## Technical notes

- New dependency: `bgutils-js` (browser only, ~small, MIT).
- No Python and no yt-dlp involved; nothing to install on the user's machine.
- Verification: real download of a track in a headless browser, byte count + IndexedDB entry checked, plus desktop and mobile screenshots of home, album, and playlist pages.
