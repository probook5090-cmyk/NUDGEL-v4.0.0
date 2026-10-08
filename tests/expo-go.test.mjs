import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appConfig = JSON.parse(await readFile(new URL("../app.json", import.meta.url), "utf8"));
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const appSource = await readFile(new URL("../App.tsx", import.meta.url), "utf8");

test("the Expo app explicitly opts out of the new architecture", () => {
  assert.equal(appConfig.expo.newArchEnabled, false);
  assert.equal(packageJson.dependencies.expo, "~54.0.37");
  assert.equal(packageJson.dependencies["react-native"], "0.81.5");
});

test("the motion stack uses React Native Animated and Expo Go modules", () => {
  assert.match(appSource, /Animated\.spring/);
  assert.match(appSource, /Animated\.timing/);
  assert.match(appSource, /from ["']expo-blur["']/);
  assert.match(appSource, /from ["']expo-linear-gradient["']/);
  assert.match(appSource, /from ["']expo-haptics["']/);
  assert.doesNotMatch(appSource, /react-native-reanimated|react-native-worklets|@shopify\/react-native-skia/);
});

test("both mobile platforms are configured for the managed Expo runtime", () => {
  assert.ok(appConfig.expo.ios.bundleIdentifier);
  assert.ok(appConfig.expo.android.package);
  assert.equal(packageJson.scripts.start, "expo start --go");
});
