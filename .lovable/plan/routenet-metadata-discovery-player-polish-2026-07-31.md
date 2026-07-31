# Routenet — Metadata, Discovery & Player Polish

Ten tasks covering the homepage, search, player, library, detail pages and the recommendation engine. Nothing is rewritten from scratch — the existing YouTube/Piped playback path and the current radio engine stay, they get refined.

## 1. Deezer enrichment everywhere (single shared service)

One enrichment helper used by the homepage, search, player and detail pages: fetch from YouTube/Piped (playable ids), then match against Deezer for title, artist, album, artwork, release date and explicit flag. Falls back to the YouTube thumbnail when no Deezer match exists, so nothing ever renders blank.

## 2. Homepage data pass

- Every homepage row is enriched with Deezer metadata (task 1).
- Remove the YouTube playlist rows from the homepage feed.
- Albums use Deezer albums; artists use Deezer artists with correct images.
- Keep playback bound to the YouTube/Piped id, only presentation comes from Deezer.

## 3. Search: Piped only, Deezer hidden

- Results come from Piped alone; Deezer is used silently for metadata, never shown as its own result rows.
- Filter out mimic/topic-clone channels and reuploads; prefer official artist channels for known artists.
- Rank by artist recognition + query relevance.
- Skeleton cards render while a query is in flight, replacing the empty state.
- Search result cards get a visual tweak: larger artwork, cleaner two-line title/artist, explicit badge, tighter spacing.

## 4. Player page bottom controls (reference image)

Rebuild the bottom section of the player to match the supplied reference exactly — same control order, same icon set, same sizing and spacing, same pill/row treatment — with one change: the square artwork in the reference becomes a circle. The circular progress ring around the artwork stays. Lyrics, save and download keep their existing behaviour, restyled to the reference.

## 5. Player metadata from Deezer

Now Playing shows the Deezer title, artist, album and high-resolution artwork for the current track, with the YouTube data as fallback. Audio source is unchanged.

## 6. Tracklist flow for albums, playlists and artist top songs

Playing any track from an album, a playlist or an artist's top songs plays that collection as an ordered queue from that track to the last one — no radio injection. Radio/recommendation flow stays the default only for single songs from home and search.

## 7. Library page rework

In the section listing Liked Songs / Recently Played / Discover / Your Library / Radio / AI DJ / Downloads / Browse: remove the feature entries, and instead surface real content — recently listened songs, recently played albums, and the user's playlists — sourced the same way as the homepage (YouTube data enriched with Deezer).

## 8. Recommendation engine — no repeats, no clustering

Refine `radioEngine` in place:
- Session history of played + queued ids and normalised title/artist keys; any candidate matching either is discarded.
- Cooldown window: a played song stays ineligible until a large number of other songs have played.
- Artist rotation: never two consecutive songs by the same artist, and at least 3–5 distinct artists before an artist can return.
- Remove any weighting that could favour specific names; scoring is derived purely from the seed and the live candidate pool.

## 9. Recommendation engine — discovery mix and queue size

- Target blend per batch: 40% closely related, 35% popular in the same genre/scene, 25% fresh or rising tracks that still match the style.
- Genre hits (trending, official, high-engagement) get priority inside the "popular" bucket.
- Initial queue drops from 50 to 25 (selected song + 24). Refill appends another 25-song batch under the same rules when the queue runs low.
- Musical continuity preserved: each batch is seeded from the currently playing track, so the style never jumps.

## 10. Full-app verification pass

Typecheck, then a browser run over home, search (typing state included), player, album, playlist, artist and library. Verify: playback still completes, no duplicate or repeated-artist runs in the queue, queue length is 25, Deezer metadata resolves, no Deezer rows in search, no YouTube playlists on home.

## Technical notes

- New `src/services/metadataEnrichment.ts` centralises Deezer matching and caching so home/search/player/detail share one code path and one cache.
- `radioEngine.ts` keeps its filter → score → diversify pipeline; the changes are a cooldown-aware history set, a bucketed selection step before diversify, and new constants (`INITIAL_QUEUE_SIZE = 25`, `REFILL_BATCH_SIZE = 25`).
- Queue-source flag on `PlayerContext` distinguishes "collection" playback (album/playlist/artist tracklist) from "radio" playback so refill only runs for the latter.
- Channel filtering for search uses a heuristic on channel name vs. Deezer artist name plus verified/topic signals — no hardcoded artist lists.
