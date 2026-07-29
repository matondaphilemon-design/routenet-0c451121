/**
 * Format a number with commas (exact, no K/M abbreviations).
 * e.g., 1234567 → "1,234,567"
 */
export function formatExactNumber(num: number | null | undefined): string {
  if (num === undefined || num === null) return "?";
  return num.toLocaleString();
}
