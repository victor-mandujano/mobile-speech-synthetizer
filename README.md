# Repo Reader (mobile-speech-synthetizer)

An Android-first Expo / React Native app for browsing a public GitHub repository, picking a `.md` or `.txt` file, and listening to it with on-device, open-source text-to-speech.

## Stack

- Expo SDK 58, React Native 0.88, TypeScript (strict)
- Expo Router (file-based routes live in `src/app/`)
- TypeScript everywhere: source, tests and config (`app.config.ts`). No JavaScript files.
- oxlint for linting and oxfmt for formatting
- Jest (`jest-expo`) with React Native Testing Library
- EAS Build for cloud builds (no local Android Studio needed)

## Getting started

```bash
npm install
npm run typecheck   # tsc --noEmit
npm run lint        # oxlint (lint:fix to auto-fix)
npm run format      # oxfmt (format:check to verify only)
npm test            # jest
```

## Running on an Android phone (development build)

The app uses a **development build** rather than Expo Go, because the on-device TTS engine will need native code.

One-time setup:

```bash
npm install -g eas-cli      # or use npx eas-cli@latest
eas login                   # your Expo account
eas init                    # links this repo to an EAS project.
```

Build and install:

```bash
npm run build:android:dev   # eas build --profile development --platform android
```

When the build finishes, EAS prints a link and QR code. Open it on the phone to download and install the APK.

Then start the dev server and open the installed app; it connects to the server on the same network:

```bash
npm start                   # expo start --dev-client
npm run start:tunnel        # same, but over a tunnel: use when the phone can't reach your
                            # computer directly (e.g. developing inside WSL2). Slower; needs internet.
```

You only need a new development build when native dependencies change. JavaScript changes reload instantly.

## Project layout

```
src/app/          Expo Router screens (_layout.tsx = navigator, index.tsx = home)
src/__tests__/    Jest tests
assets/           Icons and splash images
app.config.ts     Expo app config (typed)
.oxlintrc.json    oxlint rules
.oxfmtrc.json     oxfmt options
eas.json          EAS build profiles (development, preview, production)
```
