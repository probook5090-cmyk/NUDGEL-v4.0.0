# Runtime and motion notes

## Compatibility boundary

- Expo SDK 54 with React Native 0.81.5.
- `expo.newArchEnabled` is explicitly `false` for iOS/Android native projects generated from this app config.
- Standard Expo Go runtime for SDK/module compatibility; no prebuild-generated native projects are needed just to run the interface in Expo Go.
- Blur, gradients, haptics, icons, and status-bar styling come from Expo-maintained packages available in Expo Go.
- Screen motion, press feedback, message entrances, and the shared-avatar transition use React Native's core `Animated` API with the native driver. There is no Reanimated, Worklets, Skia, or custom native code.

Expo Go is a compiled client. Its native architecture is fixed by the Go binary, not by this app's `newArchEnabled` config. The SDK-54 Android Expo Go build uses the New Architecture; using Expo Go therefore checks managed-runtime compatibility, but does not validate a legacy-architecture native build. A native project generated from this config is needed to verify that requirement. Expo Go itself must also match SDK 54.

## Transition design

Opening a conversation animates the inbox left and slightly back while the chat enters from the right. The tapped contact avatar is measured in the inbox and rendered once in an absolute overlay; the overlay springs to the matching avatar position in the chat header, while the two in-place avatars are temporarily hidden. Closing reverses that path to the measured inbox origin. If reduced motion is enabled, navigation switches without the morph.

All decorative glass treatments are layered from a translucent Expo `BlurView`, a restrained gradient, and a fine border. Android may render blur differently from iOS, so the translucent fill and border remain part of the visual rather than relying on blur alone.
