# Routenet — Homepage, Recommendation V2, Player & Downloads

Six tasks, executed in one pass.

## Task 1 — Deezer personalized homepage sections

Add new Deezer-backed sections to the existing feed and interleave them with current rows (no separate block at the bottom).

New sections, all seeded from onboarding prefs (favorite artists, genres) plus local listening history:

- Your Daily Flow — infinite-radio row, 25 tracks, built from top artist radio + genre tracks (Deezer `/user/me/flow` needs OAuth, so it is emulated server-side from artist radio + genre charts).
- Made For You — album / artist / playlist recommendations derived from the user's artists and genres (`/artist/{id}/related`, `/search/album`, `/search/playlist`), placed directly below the 2x4 quick-access grid.
- Top Picks — song-dominant row blending history seeds with genre charts.
- Flow Moods — mood playlists (Chill, Party, Focus, Motivation, Melancholy) via Deezer playlist search, ordered by the user's genres.
- New Releases — `/editorial/0/releases` filtered against favorite genres, plus "Inspired by <latest release>" rows that pick the newest release from a favorite artist.
- Genre Charts — `/chart/{genre_id}` per onboarding genre.
- Similar Artists — `/artist/{id}/related` + `/artist/{id}/top` from the user's top artist.
- Global & Regional Charts — `/chart/0` and country chart, re-ranked by genre preference.

Rules applied to the whole feed: song rows dominate; every section runs Deezer metadata enrichment; a section that returns nothing falls back to a genre/chart query so no row renders empty; personalization filters out already-heard tracks.

Endpoints not already proxied get added to the `deezer` edge function (`related`, `chart/{genre}`, `editorial/{genre}/releases`, `country charts`).

## Task 2 — Recommendation Engine V2 (session-based curator)

Replace `radioEngine` internals with a session model:

- A manual song selection starts a session and builds ONE 100-song queue.
- Rebuild only when: user picks a new song, fewer than 10 tracks remain, the session exceeds its TTL, or context changes.
- Context gathered before building: current song (genre, mood, era, popularity), user profile (liked, playlists, library, most played, skips, completions), and time of day / day of week.
- Persistent stores in localStorage: `playedSongs`, `recentArtists`, `queueHistory` (ids, artists, timestamps, session ids).
- Cooldowns: recently played songs skipped; max 2 tracks per artist per 100-song queue; artist priority decays after each appearance.
- Distribution target: 30% closely related, 20% trending in genre, 15% new releases, 15% fan favorites, 10% classics, 10% hidden gems.
- No greatest-hits syndrome: pull album cuts and deep tracks, not only top-1 songs.
- DJ ordering: similar -> trending -> fan favorite -> discovery -> classic -> hidden gem, cycled so energy flows.
- Learning: plays, skips, completions, likes and playlist adds feed back into the taste profile.

## Task 3 — Now Playing color + control bar polish

- Rework the player theme to a true black surface with muted album-derived tinting; remove neon/saturated glow.
- Bottom pill bar refined to professional spacing and sizing, with: like, shuffle, repeat, queue, lyrics (new icon), download.
- Download becomes a small down-arrow in a circle; while downloading it renders a live progress ring, then a completed state.

## Task 4 — Lyrics page

- Remove the pause button from the lyrics view.
- Center-align lyrics with proper vertical rhythm and margins, active-line emphasis, smooth auto-scroll.

## Task 5 — Download feature fix

- Audit `downloadService`, `indexedDBService`, `trackCacheDB` and the stream resolver, fix the broken path so a track downloads end to end and plays offline.
- Wire real progress events to the player button and the library, with error and retry states.

## Task 6 — Verification

- Typecheck, then browser-drive the app: home (every section has data), search, album, playlist, artist, now playing, lyrics, download flow.
- Confirm playback and queue continuation behave per Task 2.

## Technical notes

- Deezer access stays behind the existing `deezer` edge function; new actions are added there rather than calling the API from the client.
- Recommendation state is client-side (localStorage) so it works without auth; taste events continue writing to Supabase when signed in.
- Enrichment reuses `metadataEnrichment.ts` caching so the added rows do not multiply network calls.
