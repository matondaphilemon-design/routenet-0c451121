/**
 * Convert a string to Title Case, with exceptions for common music terms.
 */
const EXCEPTIONS = new Set(["feat.", "feat", "ft.", "ft", "dj", "vip", "vs.", "vs", "a", "an", "the", "and", "or", "of", "in", "on", "at", "to", "for", "with", "by"]);
const ALWAYS_UPPER = new Set(["dj", "vip", "ep", "lp", "ii", "iii", "iv"]);

export function toTitleCase(str: string): string {
  if (!str) return str;
  return str
    .split(" ")
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (ALWAYS_UPPER.has(lower)) return word.toUpperCase();
      if (index > 0 && EXCEPTIONS.has(lower)) return lower;
      if (word.length === 0) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}
