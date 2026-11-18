# Repo Reader (mobile-speech-synthetizer)

An Android-first Expo / React Native app for browsing a public GitHub repository, picking a `.md` or `.txt` file, and listening to it with on-device, open-source text-to-speech.

## Stack

- Expo SDK 58, React Native 0.88, TypeScript (strict)
- Expo Router (file-based routes live in `src/app/`)
- ESLint (`eslint-config-expo`), Jest (`jest-expo`) with React Native Testing Library
- EAS Build for cloud builds (no local Android Studio needed)

## Getting started

```bash
npm install
npm run typecheck   # tsc --noEmit
npm run lint        # expo lint
npm test            # jest
```

## Running on an Android phone (development build)

The app uses a **development build** rather than Expo Go, because the on-device TTS engine will need native code.

One-time setup:

```bash
npm install -g eas-cli      # or use npx eas-cli@latest
eas login                   # your Expo account
eas init                    # links this repo to an EAS project (writes the projectId into app.json)
```

Build and install:

```bash
npm run build:android:dev   # eas build --profile development --platform android
```

When the build finishes, EAS prints a link and QR code. Open it on the phone to download and install the APK.

Then start the dev server and open the installed app; it connects to the server on the same network:

```bash
npm start                   # expo start --dev-client
```

You only need a new development build when native dependencies change. JavaScript changes reload instantly.

## Project layout

```
src/app/          Expo Router screens (_layout.tsx = navigator, index.tsx = home)
src/__tests__/    Jest tests
assets/           Icons and splash images
eas.json          EAS build profiles (development, preview, production)
```
