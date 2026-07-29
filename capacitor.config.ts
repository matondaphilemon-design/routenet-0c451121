import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ericbuvfh.tunestream',
  appName: 'TuneStream',
  webDir: 'dist',
  plugins: {
    NativeAudio: {
      showNotification: true,
      background: true,
      backgroundPlayback: true,
    },
  },
};

export default config;
