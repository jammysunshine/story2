import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aistorytime.app',
  appName: 'AI Storytime',
  webDir: 'dist',
  server: {
    // url: 'http://localhost:3000',
    cleartext: true,
    allowNavigation: [
      'storytime-backend-959069445137.australia-southeast1.run.app'
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
