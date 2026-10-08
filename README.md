# Luma — Liquid Glass Chat

A clean-slate, original chat interface built around translucent surfaces, a shared-avatar morph, and small, springy transitions. This replaces the previous reference UI rather than extending its screens, assets, animation stack, or navigation.

## Run in Expo Go

```bash
npm install
npm start
```

Scan the QR code with Expo Go. `npm run android` and `npm run ios` start the same managed app for a connected emulator/simulator; they do not create native projects. For a browser preview of the same UI, run `npm run web`.

### SDK and architecture boundary

Luma targets **Expo SDK 54 / React Native 0.81.5**. `app.json` sets `newArchEnabled` to `false` for native projects generated from this configuration, and the app uses only legacy-compatible React Native core `Animated` plus Expo Go-supported modules (`expo-blur`, `expo-linear-gradient`, `expo-haptics`, and `expo-status-bar`). It does not depend on Reanimated, Worklets, Skia, custom native modules, or a development build.

Expo Go is a prebuilt native app: the architecture in the Expo Go binary cannot be changed by an app's `newArchEnabled` setting. SDK-54 Expo Go Android builds use the New Architecture, so **Expo Go can verify the app's SDK/module compatibility, but it cannot prove that the app is executing on the legacy architecture**. For that specific check, a native app generated from this project's config is required. Also use an Expo Go client compatible with SDK 54; if the installed client reports an SDK mismatch, a newer client cannot be made to run the older native SDK by changing JavaScript dependencies.

## Verify

```bash
npm run verify
npx expo export --platform android
npx expo export --platform ios
npx expo export --platform web
```

The verification suite checks the architecture/runtime configuration, TypeScript, lint, and the Expo-Go-safe motion stack. Android, iOS, and web bundles are verified in CI; device-level visual, haptic, and legacy-native-architecture behavior still needs to be confirmed on real iOS and Android hardware/builds.
