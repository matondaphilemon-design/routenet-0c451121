/**
 * Format a stream count number Spotify-mobile style.
 * 1234567 -> "1,234,567"
 * Returns "" for undefined/null/0 so cards can hide the line entirely.
 */
export function formatStreams(count: number | string | null | undefined): string {
  if (count === undefined || count === null) return "";
  if (typeof count === "string") {
    const n = Number(count);
    if (!Number.isFinite(n) || n <= 0) return "";
    return n.toLocaleString();
  }
  if (typeof count !== "number" || !Number.isFinite(count) || count <= 0) return "";
  return count.toLocaleString();
}