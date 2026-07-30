/**
 * Top artists per genre — used for onboarding recommendations and as the
 * static artist → genre fallback for genre detection.
 */
export const genreArtistMap: Record<string, string[]> = {
  Trap: ["Future", "Young Thug", "Lil Baby", "Gunna", "Travis Scott", "21 Savage", "Don Toliver", "Playboi Carti", "Yeat", "Metro Boomin"],
  Afrobeats: ["Burna Boy", "Wizkid", "Davido", "Rema", "Ayra Starr", "Asake", "Tems", "Omah Lay", "Fireboy DML", "BNXN"],
  "Hip-Hop": ["Drake", "Kendrick Lamar", "J. Cole", "Travis Scott", "Future", "Tyler, The Creator", "Lil Wayne", "Nicki Minaj", "Eminem", "Kanye West"],
  Pop: ["Taylor Swift", "Dua Lipa", "Olivia Rodrigo", "Billie Eilish", "Sabrina Carpenter", "Ariana Grande", "Ed Sheeran", "The Weeknd", "Harry Styles", "Justin Bieber"],
  "R&B": ["SZA", "Brent Faiyaz", "Summer Walker", "Usher", "Chris Brown", "Giveon", "H.E.R.", "Frank Ocean", "Jhené Aiko", "Daniel Caesar"],
  Drill: ["Central Cee", "Pop Smoke", "Headie One", "Digga D", "Fivio Foreign", "Sheff G", "Unknown T", "Russ Millions"],
  Amapiano: ["Kabza De Small", "DJ Maphorisa", "Focalistic", "Uncle Waffles", "Musa Keys", "Tyler ICU", "Young Stunna"],
  Rock: ["Queen", "Foo Fighters", "Nirvana", "Arctic Monkeys", "The Killers", "Linkin Park", "Red Hot Chili Peppers", "Paramore"],
  Metal: ["Metallica", "Slipknot", "System Of A Down", "Bring Me The Horizon", "Iron Maiden", "Black Sabbath", "Deftones", "Avenged Sevenfold"],
  Electronic: ["Calvin Harris", "David Guetta", "Fred again..", "Disclosure", "Avicii", "Martin Garrix", "Skrillex", "Swedish House Mafia"],
  Indie: ["Tame Impala", "Lana Del Rey", "Clairo", "Phoebe Bridgers", "The 1975", "Vampire Weekend", "Mitski", "Mac DeMarco"],
  Jazz: ["Miles Davis", "John Coltrane", "Ella Fitzgerald", "Nina Simone", "Louis Armstrong", "Herbie Hancock", "Kamasi Washington", "Norah Jones"],
  Classical: ["Ludovico Einaudi", "Yo-Yo Ma", "Lang Lang", "Max Richter", "Hans Zimmer", "Beethoven", "Mozart", "Chopin"],
  Country: ["Morgan Wallen", "Luke Combs", "Zach Bryan", "Lainey Wilson", "Chris Stapleton", "Kacey Musgraves", "Dolly Parton", "Shania Twain"],
  Reggae: ["Bob Marley & The Wailers", "Sean Paul", "Damian Marley", "Shaggy", "Chronixx", "Protoje", "Koffee", "Buju Banton"],
  Latin: ["Bad Bunny", "Karol G", "J Balvin", "Shakira", "Feid", "Rauw Alejandro", "Peso Pluma", "Maluma"],
  "K-Pop": ["BTS", "BLACKPINK", "NewJeans", "Stray Kids", "TWICE", "SEVENTEEN", "IVE", "LE SSERAFIM"],
  "Lo-fi": ["Nujabes", "Jinsang", "idealism", "potsu", "j^p^n", "bsd.u", "Kupla", "Tomppabeats"],
  Gospel: ["Kirk Franklin", "Tasha Cobbs Leonard", "Maverick City Music", "CeCe Winans", "Elevation Worship", "Mary Mary", "Fred Hammond", "Jonathan McReynolds"],
};

/** Reverse index: lowercase artist name → canonical genre. */
export const artistGenreMap: Record<string, string> = Object.entries(genreArtistMap).reduce(
  (acc, [genre, artists]) => {
    for (const a of artists) {
      if (!acc[a.toLowerCase()]) acc[a.toLowerCase()] = genre;
    }
    return acc;
  },
  {} as Record<string, string>,
);

/** Related terms used when scoring playlists for a genre. */
export const similarGenreTerms: Record<string, string[]> = {
  trap: ["trap", "atlanta", "rap", "hip hop", "hip-hop"],
  afrobeats: ["afrobeats", "afro fusion", "afrobeat", "afropop", "african", "naija"],
  "hip-hop": ["hip-hop", "hip hop", "rap", "conscious hip-hop", "rap caviar"],
  pop: ["pop", "pop hits", "top 40", "mainstream"],
  "r&b": ["r&b", "rnb", "soul", "slow jams", "neo soul"],
  drill: ["drill", "uk drill", "ny drill", "rap"],
  amapiano: ["amapiano", "afro house", "piano"],
  rock: ["rock", "alt rock", "indie rock", "classic rock"],
  metal: ["metal", "hard rock", "heavy"],
  electronic: ["electronic", "edm", "dance", "house", "techno"],
  indie: ["indie", "bedroom pop", "alternative"],
  jazz: ["jazz", "smooth jazz", "bebop"],
  classical: ["classical", "piano", "orchestra"],
  country: ["country", "americana", "nashville"],
  reggae: ["reggae", "dancehall", "roots"],
  latin: ["latin", "reggaeton", "perreo", "latino"],
  "k-pop": ["k-pop", "kpop", "korean"],
  "lo-fi": ["lo-fi", "lofi", "chillhop", "study"],
  gospel: ["gospel", "worship", "christian", "praise"],
};
