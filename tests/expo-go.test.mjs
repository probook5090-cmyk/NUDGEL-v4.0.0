import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appConfig = JSON.parse(await readFile(new URL("../app.json", import.meta.url), "utf8"));
const companionConfig = JSON.parse(
  await readFile(new URL("../apps/mobile-companion/app.json", import.meta.url), "utf8"),
);
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const desktopPackage = JSON.parse(await readFile(new URL("../desktop/package.json", import.meta.url), "utf8"));
const appSource = await readFile(new URL("../App.tsx", import.meta.url), "utf8");
const companionSource = await readFile(new URL("../apps/mobile-companion/App.tsx", import.meta.url), "utf8");

test("both Expo apps explicitly opt out of the new architecture", () => {
  assert.equal(appConfig.expo.newArchEnabled, false);
  assert.equal(companionConfig.expo.newArchEnabled, false);
  assert.equal(packageJson.dependencies.expo, "~54.0.37");
  assert.equal(packageJson.dependencies["react-native"], "0.81.5");
  assert.equal(packageJson.dependencies["expo-camera"], "~17.0.10");
  assert.equal(packageJson.dependencies["react-native-webview"], "13.15.0");
});

test("the motion stack uses React Native Animated and Expo Go modules", () => {
  assert.match(appSource, /Animated\.spring/);
  assert.match(appSource, /Animated\.timing/);
  assert.match(appSource, /from ["']expo-blur["']/);
  assert.match(appSource, /from ["']expo-linear-gradient["']/);
  assert.match(appSource, /from ["']expo-haptics["']/);
  assert.doesNotMatch(appSource, /react-native-reanimated|react-native-worklets|@shopify\/react-native-skia/);
});

test("the desktop host and mobile companion use separate managed Expo entry points", () => {
  assert.ok(appConfig.expo.ios.bundleIdentifier);
  assert.ok(appConfig.expo.android.package);
  assert.ok(companionConfig.expo.ios.bundleIdentifier);
  assert.ok(companionConfig.expo.android.package);
  assert.equal(packageJson.scripts.start, "expo start --go");
  assert.match(packageJson.scripts.desktop, /electron desktop\/main\.cjs/);
  assert.match(packageJson.scripts["desktop:build:win"], /npm ci --prefix desktop/);
  assert.equal(packageJson.build.directories.app, "desktop");
  assert.equal(desktopPackage.main, "main.cjs");
  assert.deepEqual(Object.keys(desktopPackage.dependencies), ["qrcode"]);
  assert.match(packageJson.scripts.companion, /apps\/mobile-companion/);
});

test("Luma Link scans local QR codes and opens the live app in a WebView", () => {
  assert.match(companionSource, /CameraView/);
  assert.match(companionSource, /react-native-webview/);
  assert.match(companionSource, /normalizePreviewUrl/);
  assert.doesNotMatch(companionSource, /react-native-reanimated|react-native-worklets|@shopify\/react-native-skia/);
});
