# Verification

The iOS simulator/release record below was captured on September 27, 2026. Android support was added on October 7, 2026; the Android config, native prebuild, and JavaScript export are checked separately below. Android device/emulator visuals are not claimed without a connected SDK/emulator.

## Automated checks

| Check | Result |
| --- | --- |
| Clean `npm ci` | Passed; lockfile installs successfully. |
| Strict TypeScript and Expo ESLint | Passed. |
| Node regression suite | 19 tests covering message IDs, blank/invalid submissions, read/reset state, reactions, persistence isolation, actual router query parsing, Android configuration, asset integrity, route adapters, and documentation links. |
| `npx expo-doctor` (September 27 iOS baseline) | 21/21 checks passed then; not rerun for the Android port. |
| `npm audit` (October 7, 2026) | 22 advisories in the current dependency tree (21 high, 1 critical); dependency remediation was not part of this Android-port change. |
| iOS JavaScript export | Passed after the Android changes. |
| Android Expo config and native prebuild | Passed with `npx expo prebuild --platform android --no-install`; no APK was built. |
| Android JavaScript export | Passed with `npx expo export --platform android`. |
| Native iOS Release build | Previously recorded as passed; generated native dependencies emit Xcode deprecation warnings. |

## Android coverage

This environment has no `adb`, `ANDROID_HOME`, or `ANDROID_SDK_ROOT`, so it cannot compile/install the native Android app or run emulator/device interaction checks. Expo prebuild confirms the Android native project can be generated; it does not prove a Gradle build or device runtime. Validate Fable story gestures, Astra portrait flight, form sheets, dark/light mode, keyboard movement, Android 12+ blur and the older translucent fallback, photo pinch/close, and Reduce Motion on an Android emulator/device before calling the port device-verified.

## Simulator checks

The primary device is an isolated iPhone 17 Pro running iOS 26.5 (402 × 874 points). A separate iPhone 17e checks the narrower 390 × 844-point layout. Both cookbooks passed there at `extra-extra-extra-large` text size. Reduce Motion was then enabled in Settings, visually confirmed, and checked with timed stories, portrait expansion, and conversation navigation.

Run the native regression suite with a Release build installed and Maestro available:

```bash
SIMULATOR_UDID=<your-booted-device> npm run test:ios
```

- Fable: fold/unfold stories, horizontal portrait browsing, timed dismissal, manual close, like/reply, drag dismissal, conversation entry/back, sending and simulated replies, keyboard movement, shared-photo open/close, empty contact search, contact selection, light/dark appearance, and gallery return.
- Astra: correct contact selection after preloading, expand/collapse the ribbon, horizontal browsing, portrait navigation, native photo open/close, reactions, sending, attachment sharing, mute state, filters, empty search, composing, light/dark appearance, and gallery return.
- Navigation: cold conversation links, persisted messages after app termination, invalid contact IDs (including `constructor`), and safe return routes.

Six-second story controls also pass direct IDB checks: manual Close, like state, reply navigation, and drag dismissal. The reproducible helper is `scripts/verify-stories.py`; it requires the IDB accessibility client (validated with 1.6.1) and a companion on the same device.

```bash
idb_companion --udid <device-id> --grpc-port 10981
# In a second terminal, with the IDB Python client installed:
SIMULATOR_UDID=<device-id> python3 scripts/verify-stories.py
```

All three Maestro flows passed (3/3, 3m 23s), covering both cookbooks and cold navigation. The final photo-gesture change was then rebuilt and rechecked with native pinch and Close input. Fast story gestures and photo pinches are additionally checked with direct HID input.

The scripts handle the simulator's [first-use deep-link confirmation](https://docs.maestro.dev/reference/commands-available/openlink#ios-security-confirmation). System alerts are outside the app's view hierarchy.

## Visual and motion review

The README previews are direct captures from this build. Separate native recordings cover the Fable story controls and Astra ribbon, forward/return portrait travel, photo expansion, and 1×–2×–1× pinch. The photo viewer uses Close for native return; interactive dismissal is disabled to keep the image pinch independent. Consecutive decoded frames were inspected through those transitions. Visual inspection checks portrait alignment, copy hierarchy, message clearance above the floating composer, keyboard-open layouts, native photo transitions, and light/dark contrast. Native recordings and decoded frames are retained locally under ignored `.qa/`.

The record helper is reusable:

```bash
SIMULATOR_UDID=<your-booted-device> scripts/record-ios.sh walkthrough
```

Stop recording with Control-C. The result is written to `.qa/recordings/walkthrough.mp4`.

## Limits

This is a cross-platform native UI cookbook with local sample data. No messaging backend, authentication, calling, or voice-recording service is included. Android is configured and its JavaScript bundle and native prebuild pass, but native Android compilation and device/emulator behavior remain unverified in this environment. Web and physical-device frame-rate measurements are not verified targets. Simulator recordings demonstrate interaction and visual continuity; their frame rate is not a claim about hardware performance.
