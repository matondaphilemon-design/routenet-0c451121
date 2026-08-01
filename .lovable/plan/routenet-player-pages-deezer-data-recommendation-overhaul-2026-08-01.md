# Routenet — Player, Pages, Deezer Data & Recommendation Overhaul

Everything in one pass: the Now Playing redesign, album/playlist/home rebuilds on real Deezer data, the splash/landing logo, and a full rework of how the recommendation engine picks artists and balances new/trending/classic music. The existing playback path (Piped + YouTube failover) and the engine's architecture stay — the engine is refined, not replaced.

## 1. Now Playing — bottom section redesign

Rebuild the lower half of the player to match the reference screens:

- Circular artwork with the circular progress ring around it (square in the reference becomes a circle).
- Time labels left/right under the ring.
- Main transport row: shuffle · previous · large filled play/pause · next · repeat, evenly spaced, reference sizing.
- A translucent pill bar above the transport holding heart (save), queue and the overflow action.
- Bottom row: LYRICS with a chevron in the centre, download on one side, share on the other.
- Background stays the album-art colour-matched gradient already in place.

Behaviour of lyrics, save, download and share is unchanged — only styling and layout move.

## 2. Player metadata from Deezer

Now Playing title, artist, album and high-resolution artwork come from the shared enrichment service, falling back to the YouTube data when no Deezer match exists. The audio source stays the Piped/YouTube id.

## 3. Splash / landing logo

Use the official Routenet logo asset at full size on the splash screen with the wordmark, tagline and Get Started button, matching the supplied design.

## 4. Album page rebuild

Match the reference: large portrait cover header, title with feature line, artist line, a filled Play button beside an outlined Shuffle button, then a numbered "Top Tracks" list with thumbnail, title, artist and per-row overflow menu. Data comes from Deezer (cover, title, artist, tracklist); playback resolves each track to a playable YouTube id. Playing any row plays the album as an ordered queue from that row to the end.

## 5. Playlist page rebuild

Same structural treatment as the album page — cover header, Play/Shuffle pair, numbered tracklist with overflow menus — with playlist metadata and Deezer artwork. Ordered queue playback, no radio injection.

## 6. Homepage — Spotify-style, Deezer-backed, no mocks

- Remove every remaining mock-data row and all YouTube mixes/playlists from the feed.
- Rows: greeting header, recently played grid, featured playlists, your favourite artists (circular Deezer artist images), made for you, new releases, genre rows — all sourced from Deezer, with YouTube used only to resolve playable ids.
- Card treatment follows the reference: square art, two-line title/subtitle, tight spacing, horizontal scroll rows.

## 7. Recommendation engine — artist pool first

Rework candidate selection so the engine picks artists before it picks songs:

- Collect a much larger candidate pool (wider fan-out, more search seeds per session).
- De-duplicate songs, then group candidates by normalised artist.
- Select as many distinct qualifying artists as the batch needs, then take the best one or two songs from each.
- Genre/style relevance still gates entry into the pool, so the widening never breaks musical continuity.

## 8. Artist cooldown and exposure limits

- Persisted recently-played-artist history alongside the existing song cooldown.
- An artist stays on cooldown until a set number of other distinct artists have played, not on a wall clock alone.
- Candidates by a cooling-down artist are skipped while suitable alternatives exist, even if the song itself is new.
- Hard limits: never two consecutive songs by one artist, at most one song per artist within a short window, and a cap per batch.
- Cooldown relaxes only when the pool genuinely cannot fill the batch.

## 9. Ranking priority rewrite

Ranking order becomes: genre match, subgenre match, song not recently played, artist not recently played, stylistic similarity, popularity/quality, then randomised tie-breaking. Artist diversity becomes the highest-weight signal after genre relevance, so between two similarly relevant songs the unfamiliar artist always wins.

## 10. Balanced era mix — trending, new, classic

Each batch is blended roughly 35% closely related, 25% trending in genre, 20% recent releases, 20% evergreen classics, and mixes established, mid-career, rising and independent artists. Buckets are interleaved rather than grouped, so the queue reads: current song, trending hit, new release, similar artist, classic, rising artist, and so on. Verification pass at the end: typecheck, then a browser run over home, search, player, album, playlist and artist checking full playback, unique-artist count in the queue, no repeated artists back to back, and the new layouts rendering correctly.

## Technical notes

- `radioEngine.ts` keeps its fetch → filter → score → select pipeline. New pieces: an `artistCooldown` map keyed by normalised artist with a distinct-artist counter, a `groupByArtist` selection stage inserted before scoring, and era buckets (`related` / `trending` / `recent` / `classic`) derived from upload date and view velocity returned by the radio edge function.
- `supabase/functions/piped-radio/index.ts` gains extra query strategies (genre + "new", genre + year, genre + "mix") and returns `uploaded`/`uploadedDate` so the client can bucket by era. Fan-out is raised to widen the pool.
- Deezer chart, editorial and new-release endpoints are added to `supabase/functions/deezer/index.ts` and surfaced through `src/services/deezer.ts` for the homepage rows and the trending/recent buckets.
- Album and playlist pages call the existing `playCollection` on `PlayerContext` so fixed-queue mode is used and refill/radio never fires.
- All new colours, gradients and the pill surface go in `index.css` as semantic tokens; no hardcoded colour utilities in components.
