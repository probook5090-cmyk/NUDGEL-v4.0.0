import { Asset } from "expo-asset";
import { BlurTargetView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import { preloadOrbImages } from "../cookbooks/fable/components/ui/orb-images";
import { ME, FABLE_TEAM, PEOPLE } from "../cookbooks/fable/data/people";
import { portraits, coast } from "../cookbooks/astra/data";
import { GlassBlurTargetContext } from "../cookbooks/shared/GlassBlurTargetContext";

void SplashScreen.preventAutoHideAsync();

export const unstable_settings = { initialRouteName: "index" };

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const blurTargetRef = useRef<View>(null);
  const systemDark = useColorScheme() === "dark";
  useEffect(() => {
    let mounted = true;
    const people = [ME, FABLE_TEAM, ...PEOPLE];
    Promise.allSettled([
      preloadOrbImages(people.map((person) => person.avatar)),
      Asset.loadAsync([
        ...people.map((person) => person.story),
        ...portraits,
        coast,
      ]),
    ]).then(() => {
      if (mounted) setReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);
  if (!ready) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GlassBlurTargetContext.Provider value={blurTargetRef}>
        {Platform.OS === "android" ? (
          <BlurTargetView
            ref={blurTargetRef}
            collapsable={false}
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: systemDark ? "#111316" : "#EFF2F5" },
            ]}
          >
            <LinearGradient
              colors={
                systemDark
                  ? ["#22262B", "#111316", "#090B0D"]
                  : ["#E3EAF0", "#F5F7F9", "#E9EEF2"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </BlurTargetView>
        ) : null}
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <KeyboardProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="fable" />
              <Stack.Screen name="astra" />
            </Stack>
          </KeyboardProvider>
        </SafeAreaProvider>
      </GlassBlurTargetContext.Provider>
    </GestureHandlerRootView>
  );
}
