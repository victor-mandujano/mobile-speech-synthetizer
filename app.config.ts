import type { ExpoConfig } from 'expo/config';

import withPiperVoice from './plugins/with-piper-voice.ts';

const config: ExpoConfig = {
  name: 'Repo Reader',
  slug: 'mobile-speech-synthetizer',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'reporeader',
  userInterfaceStyle: 'automatic',
  android: {
    package: 'com.victormandujano.reporeader',
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
  },
  web: {
    output: 'single',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#208AEF',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
    [
      'expo-audio',
      {
        microphonePermission: false,
        recordAudioAndroid: false,
        enableBackgroundPlayback: false,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  owner: 'eleutheria-technologies',
  extra: {
    eas: {
      projectId: 'de3f0610-9376-41c2-a769-abb0030e385d',
    },
  },
};

export default withPiperVoice(config);
