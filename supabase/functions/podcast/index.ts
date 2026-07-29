import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PODCAST_INDEX_API = 'https://api.podcastindex.org/api/1.0';

// Helper to create authentication headers for Podcast Index
async function getPodcastIndexHeaders(): Promise<Record<string, string>> {
  const apiKey = Deno.env.get('PODCAST_INDEX_API_KEY') || '';
  const apiSecret = Deno.env.get('PODCAST_INDEX_API_SECRET') || '';
  const apiHeaderTime = Math.floor(Date.now() / 1000);
  
  // Create SHA-1 hash of key + secret + timestamp
  const hashInput = apiKey + apiSecret + apiHeaderTime;
  const encoder = new TextEncoder();
  const data = encoder.encode(hashInput);
  
  // Using Web Crypto API for SHA-1
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return {
    'User-Agent': 'EchoTunes/1.0',
    'X-Auth-Key': apiKey,
    'X-Auth-Date': apiHeaderTime.toString(),
    'Authorization': hash,
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, params } = await req.json();
    console.log(`Podcast API: action=${action}`, params);

    let url: string;
    const headers = getPodcastIndexHeaders();

    switch (action) {
      case 'searchPodcasts':
        url = `${PODCAST_INDEX_API}/search/byterm?q=${encodeURIComponent(params.query)}&max=${params.limit || 20}`;
        break;
      case 'getTrendingPodcasts':
        url = `${PODCAST_INDEX_API}/podcasts/trending?max=${params.limit || 20}&lang=en&cat=${params.category || ''}`;
        break;
      case 'getRecentEpisodes':
        url = `${PODCAST_INDEX_API}/recent/episodes?max=${params.limit || 20}&lang=en`;
        break;
      case 'getPodcastById':
        url = `${PODCAST_INDEX_API}/podcasts/byfeedid?id=${params.feedId}`;
        break;
      case 'getEpisodesByPodcast':
        url = `${PODCAST_INDEX_API}/episodes/byfeedid?id=${params.feedId}&max=${params.limit || 20}`;
        break;
      case 'getCategories':
        url = `${PODCAST_INDEX_API}/categories/list`;
        break;
      case 'getRandomEpisodes':
        url = `${PODCAST_INDEX_API}/episodes/random?max=${params.limit || 10}&lang=en`;
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    console.log(`Fetching: ${url}`);

    const response = await fetch(url, { headers: await headers });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Podcast Index API error: ${response.status}`, errorText);
      
      // Return mock data for demo purposes if API fails
      console.log('Returning mock podcast data');
      return new Response(JSON.stringify(getMockData(action, params)), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    console.log(`Podcast response received`);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Podcast function error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Return mock data on error for demo
    try {
      const { action, params } = await req.clone().json();
      return new Response(JSON.stringify(getMockData(action, params)), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch {
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }
});

// Mock data for when API is unavailable
function getMockData(action: string, params: any) {
  const mockPodcasts = [
    {
      id: 1,
      title: 'The Daily Tech',
      author: 'Tech Weekly',
      image: 'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=300',
      description: 'Daily technology news and insights',
      categories: { '1': 'Technology' },
    },
    {
      id: 2,
      title: 'Music Stories',
      author: 'Sound Archives',
      image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300',
      description: 'Stories behind your favorite songs',
      categories: { '1': 'Music' },
    },
    {
      id: 3,
      title: 'Creative Minds',
      author: 'Art & Design',
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300',
      description: 'Interviews with creative professionals',
      categories: { '1': 'Arts' },
    },
    {
      id: 4,
      title: 'Health Matters',
      author: 'Wellness Hub',
      image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=300',
      description: 'Health and wellness tips',
      categories: { '1': 'Health' },
    },
    {
      id: 5,
      title: 'Business Insights',
      author: 'Entrepreneur Daily',
      image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=300',
      description: 'Business strategies and success stories',
      categories: { '1': 'Business' },
    },
    {
      id: 6,
      title: 'Science Hour',
      author: 'Discovery Network',
      image: 'https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=300',
      description: 'Exploring the wonders of science',
      categories: { '1': 'Science' },
    },
  ];

  const mockEpisodes = [
    {
      id: 101,
      title: 'The Future of AI in Music',
      feedTitle: 'The Daily Tech',
      feedImage: 'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=300',
      duration: 2400,
      datePublished: Date.now() / 1000 - 86400,
      description: 'Exploring how AI is transforming music creation',
    },
    {
      id: 102,
      title: 'Behind the Beatles Legacy',
      feedTitle: 'Music Stories',
      feedImage: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300',
      duration: 3600,
      datePublished: Date.now() / 1000 - 172800,
      description: 'The untold stories of the Fab Four',
    },
    {
      id: 103,
      title: 'Design Thinking in Practice',
      feedTitle: 'Creative Minds',
      feedImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300',
      duration: 1800,
      datePublished: Date.now() / 1000 - 259200,
      description: 'How to apply design thinking to everyday problems',
    },
    {
      id: 104,
      title: 'Sleep Science Secrets',
      feedTitle: 'Health Matters',
      feedImage: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=300',
      duration: 2100,
      datePublished: Date.now() / 1000 - 345600,
      description: 'Understanding the science of better sleep',
    },
    {
      id: 105,
      title: 'Startup Funding 101',
      feedTitle: 'Business Insights',
      feedImage: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=300',
      duration: 2700,
      datePublished: Date.now() / 1000 - 432000,
      description: 'Guide to raising capital for your startup',
    },
    {
      id: 106,
      title: 'Black Holes Explained',
      feedTitle: 'Science Hour',
      feedImage: 'https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=300',
      duration: 3000,
      datePublished: Date.now() / 1000 - 518400,
      description: 'Journey into the mysteries of black holes',
    },
  ];

  switch (action) {
    case 'searchPodcasts':
    case 'getTrendingPodcasts':
      return { feeds: mockPodcasts.slice(0, params?.limit || 6) };
    case 'getRecentEpisodes':
    case 'getRandomEpisodes':
      return { episodes: mockEpisodes.slice(0, params?.limit || 6) };
    case 'getPodcastById':
      return { feed: mockPodcasts[0] };
    case 'getEpisodesByPodcast':
      return { items: mockEpisodes.slice(0, params?.limit || 6) };
    case 'getCategories':
      return { feeds: [
        { id: 1, name: 'Arts' },
        { id: 2, name: 'Business' },
        { id: 3, name: 'Comedy' },
        { id: 4, name: 'Education' },
        { id: 5, name: 'Health' },
        { id: 6, name: 'Music' },
        { id: 7, name: 'News' },
        { id: 8, name: 'Science' },
        { id: 9, name: 'Sports' },
        { id: 10, name: 'Technology' },
      ]};
    default:
      return { feeds: [], episodes: [] };
  }
}
