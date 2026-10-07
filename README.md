# NUDGEL

A single-screen Expo + React Native conversation inspired by the Astra Liquid Glass chat reference. The screen opens directly into Mira Ellis’s sample chat, with frosted message surfaces, a shared coastal photo, a keyboard-aware composer, local sample replies, and message reactions.

## Run in Expo Go (Android or iOS)

Requirements: Node.js LTS and Expo Go on your phone.

```sh
npm install
npx expo start
```

Keep the terminal running, connect the phone and computer to the same Wi-Fi, open Expo Go, and scan the QR code. If the LAN connection is blocked, stop Expo with `Ctrl+C` and use:

```sh
npx expo start --tunnel
```

The app uses Expo Go-compatible packages and bundled local artwork. On iOS, `expo-blur` supplies the system-backed frosted surface; Android uses backdrop blur on supported Android versions with translucent tints, gradient highlights, borders, and elevation as the safe fallback. This is a Liquid Glass-inspired treatment, not exact iOS 26 Liquid Glass parity. The app has no backend; sent messages and replies are simulated locally.

To validate JavaScript bundling for either platform without building an APK or native project:

```sh
npx expo export --platform android
npx expo export --platform ios
```
