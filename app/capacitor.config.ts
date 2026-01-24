import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aistorytime.app',
  appName: 'AI Storytime',
  webDir: 'dist',
  server: {
    cleartext: true,
    allowNavigation: [
      'https://storytime-backend-q3ns32tlga-ts.a.run.app'
    ]
  },
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '959069445137-ka5n2b0h3ruljb39lhviagf498dsg648.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;
