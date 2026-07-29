/**
 * 29 hardcoded homepage sections. Containers are permanent; only the
 * card data inside changes when the AI content service resolves.
 */
export type SectionLayout = "carousel" | "grid" | "list" | "hero";
export type SectionContentType = "song" | "album" | "artist" | "playlist" | "podcast";

export interface SectionSlot {
  id: string;
  title: string;
  layout: SectionLayout;
  contentType: SectionContentType;
  aiRule: string;
  isPersonal?: boolean;
}

export const SECTIONS: SectionSlot[] = [
  { id: "dailyMix",       title: "Your Daily Mix",        layout: "carousel", contentType: "song",     aiRule: "25-50 fresh personalized tracks for today, 60% familiar from my artists/genres, 40% new discoveries", isPersonal: true },
  { id: "topMixes",       title: "Your top mixes",       layout: "carousel", contentType: "playlist", aiRule: "personalized mixes based on my favorite artists", isPersonal: true },
  { id: "topArtist",      title: "Top Artist Spotlight",  layout: "hero",     contentType: "artist",   aiRule: "my most-listened artist's top tracks", isPersonal: true },
  { id: "freshDrops",     title: "Fresh Drops",           layout: "carousel", contentType: "song",     aiRule: "songs released in the last 7 days from genres I like" },
  { id: "newAlbumsWeek",  title: "New Album Releases This Week", layout: "grid", contentType: "album", aiRule: "albums released in the last 7 days from artists similar to my favorites", isPersonal: true },
  { id: "recentlyPlayed", title: "Recently played",     layout: "carousel", contentType: "song",     aiRule: "recently popular tracks similar to my taste" },
  { id: "recommended",    title: "Recommended for you", layout: "carousel", contentType: "song",     aiRule: "songs similar to my liked artists, 70% popular 30% new", isPersonal: true },
  { id: "newReleases",    title: "New releases",         layout: "grid",     contentType: "album",    aiRule: "albums released in the last 30 days from genres I like" },
  { id: "trendingNow",    title: "Trending Now",         layout: "carousel", contentType: "song",     aiRule: "viral hits this week, focused on my preferred genres", isPersonal: true },
  { id: "chill",          title: "Chill vibes",          layout: "carousel", contentType: "song",     aiRule: "lo-fi, acoustic, relaxing instrumentals" },
  { id: "workoutEnergy",  title: "Workout Energy",       layout: "carousel", contentType: "song",     aiRule: "high BPM, energetic tracks for working out" },
  { id: "party",          title: "Party starters",       layout: "carousel", contentType: "song",     aiRule: "dance, hip hop, pop anthems" },
  { id: "sleep",          title: "Sleep sounds",         layout: "carousel", contentType: "song",     aiRule: "calming piano, nature sounds, ambient" },
  { id: "retro80s",       title: "Back to the 80s",      layout: "carousel", contentType: "song",     aiRule: "iconic 80s pop, rock, synthwave" },
  { id: "retro90s",       title: "90s nostalgia",        layout: "carousel", contentType: "song",     aiRule: "90s alternative, hip hop, boy bands" },
  { id: "retro00s",       title: "2000s throwback",      layout: "carousel", contentType: "song",     aiRule: "2000s pop-punk, R&B, indie" },
  { id: "artistRadio",    title: "Artist radio",         layout: "carousel", contentType: "song",     aiRule: "tracks similar to my top artist", isPersonal: true },
  { id: "genreDeep",      title: "Genre deep dive",      layout: "grid",     contentType: "album",    aiRule: "essential albums from my favorite genre", isPersonal: true },
  { id: "discovery",      title: "Fresh finds",          layout: "carousel", contentType: "artist",   aiRule: "upcoming artists with smaller fanbases in my genres" },
  { id: "podcasts",       title: "Top podcasts",         layout: "list",     contentType: "podcast",  aiRule: "popular episodes from tech, news, comedy" },
  { id: "liveSessions",   title: "Live sessions",        layout: "carousel", contentType: "song",     aiRule: "acoustic live performances, Tiny Desk style" },
  { id: "instrumental",   title: "Instrumental gems",    layout: "carousel", contentType: "song",     aiRule: "guitar, piano, cinematic scores" },
  { id: "localHeroes",    title: "Local heroes",         layout: "grid",     contentType: "artist",   aiRule: "artists from my country who are gaining popularity", isPersonal: true },
  { id: "fanFavorites",   title: "Fan favorites",        layout: "carousel", contentType: "song",     aiRule: "most loved songs by users similar to me" },
  { id: "soundtracks",    title: "Epic soundtracks",     layout: "carousel", contentType: "album",    aiRule: "movie and game scores" },
  { id: "jazzBlues",      title: "Jazz & blues",         layout: "carousel", contentType: "song",     aiRule: "classic and modern jazz, blues, soul" },
  { id: "electronic",     title: "Electronic escape",    layout: "carousel", contentType: "song",     aiRule: "house, techno, EDM, deep house" },
  { id: "rockAnthems",    title: "Rock anthems",         layout: "carousel", contentType: "song",     aiRule: "classic rock, alternative, hard rock" },
  { id: "hipHopFresh",    title: "Hip hop fresh",        layout: "carousel", contentType: "song",     aiRule: "latest hip hop tracks, trending on TikTok" },
  { id: "indieSpotlight", title: "Indie spotlight",      layout: "carousel", contentType: "artist",   aiRule: "emerging indie bands and solo artists" },
  { id: "holiday",        title: "Holiday cheer",        layout: "carousel", contentType: "song",     aiRule: "seasonal, Christmas, festive music" },
];