/**
 * Balanced playlist + search ranking.
 * Combined score = 75% popularity + 25% recency.
 *
 * Works with Deezer-shaped objects. We accept loose shapes so the same
 * helpers can be used on UnifiedTrack, DeezerTrack, or raw API rows.
 */

type Loose = Record<string, any>;

export function getPopularityScore(item: Loose): number {
  const pop = Number(
    item?.nb_streaming ?? item?.nb_fan ?? item?.streams ?? item?.rank ?? 0
  );
  if (!Number.isFinite(pop) || pop <= 0) return 0;
  // log10 normalization, capped at 1.0 (~1M+ = max).
  return Math.min(Math.log10(pop + 1) / 6, 1);
}

export function getRecencyScore(item: Loose): number {
  const raw =
    item?.release_date ??
    item?.releaseDate ??
    item?.album?.release_date ??
    null;
  if (!raw) return 0.3; // neutral fallback when missing
  const t = new Date(raw).getTime();
  if (!Number.isFinite(t)) return 0.3;
  const daysSince = (Date.now() - t) / 86_400_000;
  if (daysSince < 180) return 1.0; // last 6 months
  if (daysSince < 365) return 0.8;
  if (daysSince < 730) return 0.5;
  if (daysSince < 1825) return 0.3; // <5y
  return 0.1;
}

export function getCombinedScore(item: Loose): number {
  return 0.75 * getPopularityScore(item) + 0.25 * getRecencyScore(item);
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Build a balanced playlist from a candidate pool.
 * ~75% from the "popular" bucket, ~25% from the "new" bucket,
 * fall back to combined-score top picks if either bucket is short.
 */
export function balancePlaylist<T extends Loose>(
  candidates: T[],
  targetSize = 20,
  popularRatio = 0.75
): T[] {
  if (!candidates || candidates.length === 0) return [];

  const scored = candidates.map((item) => ({
    item,
    pop: getPopularityScore(item),
    rec: getRecencyScore(item),
    combined: getCombinedScore(item),
  }));
  scored.sort((a, b) => b.combined - a.combined);

  const popular = scored.filter((s) => s.pop >= 0.6);
  const fresh = scored.filter((s) => s.rec >= 0.8);

  const popularNeeded = Math.floor(targetSize * popularRatio);
  const newNeeded = targetSize - popularNeeded;

  const seen = new Set<unknown>();
  const take = (list: typeof scored, n: number): T[] => {
    const out: T[] = [];
    for (const s of list) {
      if (out.length >= n) break;
      const key = (s.item as any)?.id ?? s.item;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s.item);
    }
    return out;
  };

  const selected: T[] = [
    ...take(popular, popularNeeded),
    ...take(fresh, newNeeded),
  ];

  if (selected.length < targetSize) {
    selected.push(...take(scored, targetSize - selected.length));
  }

  return shuffle(selected).slice(0, targetSize);
}

/**
 * Rank search results: relevance filter first, then 75/25 popularity/recency.
 */
export function rankSearchResults<T extends Loose>(
  results: T[],
  query: string
): T[] {
  if (!results || results.length === 0) return [];
  const q = query.trim().toLowerCase();

  const relevant = q
    ? results.filter((item) => {
        const name = String(item?.name ?? item?.title ?? "").toLowerCase();
        const artist = String(
          item?.artist?.name ?? item?.artist ?? ""
        ).toLowerCase();
        return name.includes(q) || artist.includes(q);
      })
    : results;

  return relevant
    .map((item) => ({ item, score: getCombinedScore(item) }))
    .sort((a, b) => b.score - a.score)
    .map((s) => s.item);
}