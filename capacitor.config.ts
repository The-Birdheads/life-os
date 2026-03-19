import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.morikuma.habitas',
  appName: 'Habitas',
  webDir: 'dist',
  ios: {
    useCocoaPods: true
  }
};

export default config;
