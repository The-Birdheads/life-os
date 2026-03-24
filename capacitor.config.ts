import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.morikuma.habitas',
  appName: 'Habitas',
  webDir: 'dist',
  ios: {
    dependencyManager: 'cocoapods'
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1E293B',
      overlaysWebView: false
    }
  }
};

export default config;
