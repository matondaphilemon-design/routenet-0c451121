/**
 * Extract a dominant RGB color from an image URL using a small offscreen
 * canvas. Falls back to a neutral charcoal on any failure (CORS, decode, etc).
 * Caches per-URL so repeated reads are free.
 */
const cache = new Map<string, { r: number; g: number; b: number }>();

export async function getDominantColor(url: string): Promise<{ r: number; g: number; b: number }> {
  if (!url) return { r: 30, g: 30, b: 38 };
  const cached = cache.get(url);
  if (cached) return cached;
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej();
    });
    const c = document.createElement("canvas");
    const size = 32;
    c.width = size; c.height = size;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 128) continue;
      // Skip near-white & near-black to favour vivid hues
      const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (lum < 20 || lum > 235) continue;
      r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
    }
    if (n === 0) return { r: 60, g: 30, b: 40 };
    const out = { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
    cache.set(url, out);
    return out;
  } catch {
    return { r: 60, g: 30, b: 40 };
  }
}

/** Build a top-to-bottom gradient that fades the dominant color into deep black. */
export function gradientFromRGB(c: { r: number; g: number; b: number }): string {
  const top = `rgb(${c.r}, ${c.g}, ${c.b})`;
  const mid = `rgb(${Math.round(c.r * 0.4)}, ${Math.round(c.g * 0.4)}, ${Math.round(c.b * 0.4)})`;
  return `linear-gradient(180deg, ${top} 0%, ${mid} 45%, #0a0a0a 100%)`;
}