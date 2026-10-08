# Luma Studio + Luma Link

A private, local-network preview workflow for this Expo app:

- **Luma Studio** is a Windows desktop host. It starts the Expo web preview on the PC and shows a QR code for that PC's private Wi-Fi address.
- **Luma Link** is the mobile companion in `apps/mobile-companion`. It scans the desktop QR and displays the live web app inside an in-app WebView.
- The root Expo project is the app being previewed: an original liquid-glass chat UI. Metro hot reload sends edits to the already-connected phone, so the QR usually needs to be scanned only once per session.

Nothing is uploaded to a cloud service or tunnel. The PC and phone need to be on the same private Wi-Fi/Ethernet network. The QR contains a private LAN address and the companion rejects public URLs.

## Windows setup

Install Node.js 22, open this repository in PowerShell or Command Prompt, then:

```powershell
npm ci
npm run desktop
```

Luma Studio opens a Windows desktop window and starts the web preview from this repository. On first launch of a packaged installer, choose the Expo project folder. That folder must have `app.json`, `package.json`, and dependencies installed (`npm ci`). If Windows Firewall asks, allow Node.js on **Private networks** so your phone can reach the PC.

To build the Windows installer from a Windows machine:

```powershell
npm run desktop:build:win
```

The installer is written to `release/`. It is a local preview host and expects Node.js plus an installed Expo project on the PC; it does not upload project files.

## Mobile companion

Start Luma Link from the repository root:

```bash
npm run companion
```

Open its Metro QR with a matching Expo Go client the first time. Once Luma Link is running on the phone, scan the separate QR displayed by Luma Studio. `npm run companion:android` and `npm run companion:ios` target connected emulators/simulators.

For an installed companion app rather than Expo Go, generate a native iOS/Android build from `apps/mobile-companion/app.json`. The companion's QR is intended for the same local network; it will not connect through mobile data or a cloud tunnel.

## Architecture and rendering

Both Expo configs set `newArchEnabled` to `false`. The chat UI's motion uses React Native core `Animated`; the companion uses Expo Camera for QR scanning and `react-native-webview` for the embedded preview. These packages are compatible with the legacy architecture and are included in the matching Expo Go SDK. No Reanimated, Worklets, Skia, custom native modules, tunnel, or hosted backend is used.

Expo Go itself is a prebuilt client: its architecture is fixed by the Go binary, so the app config cannot switch Expo Go's internals to the legacy architecture. The source/config avoid new-architecture-only APIs and set legacy architecture for native projects generated from the config, but a true legacy-runtime check requires a native build. Expo Go and the project must also use a compatible SDK 54 runtime.

The phone shows the **web-rendered** version of the chat UI inside WebView. It supports the local web implementations of blur and gradients; haptics and native-only rendering are not reproduced in that web preview. Use a native app build if you need to validate the native appearance or native device behavior.

## Verify

```bash
npm run verify
npx expo export --platform android
npx expo export --platform ios
npx expo export --platform web
cd apps/mobile-companion
npx expo export --platform android --platform ios
```

These checks validate TypeScript, lint, tests, and bundle generation. Device camera permissions, Windows Firewall behavior, and real phone hot reload still need testing on the target devices/network.
