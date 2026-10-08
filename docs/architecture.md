# Luma local preview architecture

## Components

- `desktop/` — Electron Windows host. It selects an Expo project, discovers a private LAN IPv4 address, starts that project's Metro web server on port 8081, creates a QR code, and displays local status. It stores no cloud credentials and opens no tunnel.
- Root Expo project — the preview target. The current target is the original Luma glass-chat UI. Expo web runs on the PC; Metro hot reload updates an already-connected WebView when source files change.
- `apps/mobile-companion/` — Luma Link. Expo Camera reads only QR codes containing private RFC1918 IPv4 HTTP links. A validated link opens inside `react-native-webview`; navigation to other hosts is blocked.

The mobile companion's Metro server uses port 8082 so it can run beside the PC's preview server on port 8081. Keep the PC and phone on the same Wi-Fi. Windows Firewall must allow the Node.js preview process on private networks.

## Legacy-architecture boundary

Both Expo configs set `newArchEnabled: false`. UI motion uses React Native core `Animated`; the native scanner uses Expo Camera and WebView. There are no Reanimated, Worklets, Skia, or custom native modules. The APIs are legacy-compatible and are supported in a matching Expo Go client.

Expo Go is prebuilt, and its own architecture is controlled by the Go binary rather than `newArchEnabled`. Therefore Expo Go checks SDK/module compatibility but cannot prove that the app is running on the legacy architecture. A native build generated from the companion config is needed for that check.

## Preview limitations

Luma Link embeds the web export/dev-server view, not the native iOS/Android renderer. Blur and gradients have web implementations, but native haptics, camera behavior of the target app, and platform-specific native layouts are not represented in the remote web preview. No public tunnel or cloud relay is configured.
