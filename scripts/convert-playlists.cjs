/* eslint-disable */
/**
 * Playlist dataset converter.
 *
 * Clones public playlist datasets and converts them into a single structured
 * JSON file consumed by the app at runtime (public/playlist-data.json).
 *
 * Usage:
 *   node scripts/convert-playlists.js            # bundled (small) sources
 *   node scripts/convert-playlists.js --all      # also large opt-in sources
 *
 * Sources
 * -------
 * Bundled (small, ships with the app):
 *   - HariSekhon/Spotify-Playlists  (400+ playlists / 100k+ tracks)
 *   - sanxods/spotify-top-50-songs  (Top 50 per country, CSV)
 *
 * Opt-in / too large to bundle (multi-GB, must be hosted externally and loaded
 * through the same JSON shape):
 *   - Alvaro8gb/spotify_million_playlist_dataset
 *   - MTG/melon-music-dataset
 *   - dimitreOliveira/RecsysChallenge_Spotify
 *   - anaezquerro/recsys-smpd
 *   - EsraaMosaad/Spotify-Million-Playlist-Dataset-Analysis-and-Visualization
 *   - waldvoid/spotifyProject
 * Point EXTRA_JSON_DIR at a folder of MPD slice files to fold them in.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const TMP = path.join(process.cwd(), ".dataset-cache");
const OUTPUT = path.join(process.cwd(), "public", "playlist-data.json");
const EXTRA_JSON_DIR = process.env.EXTRA_JSON_DIR || "";
const INCLUDE_LARGE = process.argv.includes("--all");

const SKIP_DIRS = new Set([
  ".git", "scripts", "setup", "bash-tools", "spotify-tools", "spotify",
  "aggregations", "old", "node_modules",
]);

function clone(repo, dir) {
  const target = path.join(TMP, dir);
  if (fs.existsSync(target)) return target;
  fs.mkdirSync(TMP, { recursive: true });
  execSync(`git clone --depth 1 -q https://github.com/${repo}.git "${target}"`, { stdio: "inherit" });
  return target;
}

const result = { generatedAt: new Date().toISOString(), playlists: [], tracks: {}, artists: {} };
let trackSeq = 0;

function addTrack(artist, title) {
  const key = `${artist.toLowerCase()}|${title.toLowerCase()}`;
  if (!result.tracks[key]) {
    result.tracks[key] = { id: `tr_${trackSeq++}`, artist, track: title };
  }
  const artistKey = artist.toLowerCase();
  if (!result.artists[artistKey]) {
    result.artists[artistKey] = { id: `ar_${Object.keys(result.artists).length}`, name: artist, count: 0 };
  }
  result.artists[artistKey].count += 1;
  return result.tracks[key];
}

function parseLine(line) {
  const clean = line.replace(/\uFEFF/g, "").trim();
  if (!clean || clean.startsWith("#")) return null;
  const idx = clean.indexOf(" - ");
  if (idx === -1) return null;
  const artist = clean.slice(0, idx).trim();
  const title = clean.slice(idx + 3).trim();
  if (!artist || !title) return null;
  return { artist, title };
}

function walk(dir, prefix = "") {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, prefix ? `${prefix} / ${entry.name}` : entry.name);
      continue;
    }
    if (/\.(description|md|sh|py|json|yml|yaml|txt\.bak|gitignore)$/i.test(entry.name)) continue;
    if (entry.name.startsWith(".")) continue;

    const raw = fs.readFileSync(full, "utf-8");
    const tracks = raw.split("\n").map(parseLine).filter(Boolean);
    if (tracks.length < 3) continue;

    const title = entry.name.replace(/\.txt$/i, "").replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "").trim();
    const descPath = `${full}.description`;
    const description = fs.existsSync(descPath) ? fs.readFileSync(descPath, "utf-8").trim().slice(0, 400) : "";

    result.playlists.push({
      id: `pl_${result.playlists.length}`,
      title,
      category: prefix || "General",
      description,
      source: "HariSekhon/Spotify-Playlists",
      tracks: tracks.map((t) => {
        const rec = addTrack(t.artist, t.title);
        return { id: rec.id, artist: rec.artist, track: rec.track };
      }),
    });
  }
}

function parseCsvTopSongs(dir) {
  const files = [];
  (function collect(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === ".git") continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) collect(p);
      else if (/\.csv$/i.test(e.name)) files.push(p);
    }
  })(dir);

  for (const file of files) {
    const lines = fs.readFileSync(file, "utf-8").split("\n").filter((l) => l.trim());
    if (lines.length < 4) continue;
    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const ti = header.findIndex((h) => /track|song|title|name/.test(h));
    const ai = header.findIndex((h) => /artist/.test(h));
    if (ti === -1 || ai === -1) continue;
    const tracks = [];
    for (const line of lines.slice(1)) {
      const cols = line.match(/("([^"]*)"|[^,]*)(,|$)/g)?.map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "").trim()) || [];
      const artist = cols[ai];
      const title = cols[ti];
      if (!artist || !title) continue;
      const rec = addTrack(artist, title);
      tracks.push({ id: rec.id, artist: rec.artist, track: rec.track });
    }
    if (tracks.length < 3) continue;
    result.playlists.push({
      id: `pl_${result.playlists.length}`,
      title: `Top 50 — ${path.basename(file, ".csv").replace(/[_-]/g, " ")}`,
      category: "Charts",
      description: "Daily chart snapshot",
      source: "sanxods/spotify-top-50-songs",
      tracks,
    });
  }
}

function parseMpdSlices(dir) {
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    const data = JSON.parse(fs.readFileSync(path.join(dir, file), "utf-8"));
    for (const pl of data.playlists || []) {
      const tracks = (pl.tracks || []).map((t) => {
        const rec = addTrack(t.artist_name, t.track_name);
        return { id: rec.id, artist: rec.artist, track: rec.track };
      });
      if (tracks.length < 3) continue;
      result.playlists.push({
        id: `pl_${result.playlists.length}`,
        title: pl.name,
        category: "Million Playlist Dataset",
        description: "",
        source: "spotify-million-playlist-dataset",
        tracks,
      });
    }
  }
}

function main() {
  const hari = clone("HariSekhon/Spotify-Playlists", "hari");
  walk(hari);

  try {
    const top50 = clone("sanxods/spotify-top-50-songs", "top50");
    parseCsvTopSongs(top50);
  } catch (e) {
    console.warn("skipped top-50 dataset:", e.message);
  }

  if (INCLUDE_LARGE && EXTRA_JSON_DIR && fs.existsSync(EXTRA_JSON_DIR)) {
    parseMpdSlices(EXTRA_JSON_DIR);
  }

  result.playlists.sort((a, b) => b.tracks.length - a.tracks.length);

  // Compact wire format (v2): dedupe artist/track strings so the payload stays small.
  const artistNames = [];
  const artistIndex = new Map();
  const trackRows = [];
  const trackIndex = new Map();

  for (const key of Object.keys(result.tracks)) {
    const t = result.tracks[key];
    const ak = t.artist.toLowerCase();
    if (!artistIndex.has(ak)) {
      artistIndex.set(ak, artistNames.length);
      artistNames.push(t.artist);
    }
    trackIndex.set(t.id, trackRows.length);
    trackRows.push([artistIndex.get(ak), t.track]);
  }

  const compact = {
    v: 2,
    generatedAt: result.generatedAt,
    artists: artistNames,
    tracks: trackRows,
    playlists: result.playlists.map((pl) => ({
      t: pl.title,
      c: pl.category,
      d: pl.description || undefined,
      s: pl.source,
      k: pl.tracks.map((t) => trackIndex.get(t.id)),
    })),
  };

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(compact));
  console.log(
    `Converted ${result.playlists.length} playlists, ${Object.keys(result.tracks).length} unique tracks, ${Object.keys(result.artists).length} artists -> ${OUTPUT}`
  );
}

main();
