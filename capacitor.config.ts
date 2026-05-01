import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.morikuma.habitas',
  appName: 'Habitas',
  webDir: 'dist',
  ios: {
    dependencyManager: 'cocoapods'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: false,
      backgroundColor: '#6DCAA6',
      iosSpinnerStyle: 'small',
      spinnerColor: '#ffffff',
      showSpinner: false,
    }
  }
};

export default config;
