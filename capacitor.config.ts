import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.ab0527cb91e04667af4aefc7dfc451bc',
  appName: 'routenet',
  webDir: 'dist',
  server: {
    url: 'https://ab0527cb-91e0-4667-af4a-efc7dfc451bc.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  plugins: {
    NativeAudio: {
      showNotification: true,
      background: true,
      backgroundPlayback: true,
    },
  },
};

export default config;
