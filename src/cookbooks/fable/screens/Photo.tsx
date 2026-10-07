import { StatusBar } from "expo-status-bar";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { Platform, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassButton } from "../components/ui/glass-button";
import { PEOPLE_BY_ID } from "../data/people";
import { NotFound } from "../../NotFound";

export default function Photo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const person = PEOPLE_BY_ID[id];
  if (!person) return <NotFound home="/fable" />;
  return (
    <View style={{ flex: 1, backgroundColor: "#101012" }}>
      <StatusBar style="light" />
      <Animated.View
        style={{ flex: 1 }}
        entering={Platform.OS === "android" ? ZoomIn.duration(220) : undefined}
      >
        <Image source={person.story} contentFit="contain" style={{ flex: 1 }} />
      </Animated.View>
      <View style={{ position: "absolute", right: 20, top: insets.top + 12 }}>
        <GlassButton
          symbol="xmark"
          tint="#FFFFFF"
          accessibilityLabel="Close photo"
          onPress={() => router.back()}
        />
      </View>
    </View>
  );
}
