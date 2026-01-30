import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.studdybuddies.app',
  appName: 'StudyBudy',
  webDir: 'out',
  server: {
    // Using local IP for physical device connectivity
    url: 'http://192.168.4.241:3000',
    cleartext: true
  }
};

export default config;
