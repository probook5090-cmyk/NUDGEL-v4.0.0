import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useContext } from "react";
import {
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import { GlassBlurTargetContext } from "./GlassBlurTargetContext";

type GlassSurfaceProps = Omit<ViewProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  dark: boolean;
  clear?: boolean;
  tint?: string;
};

/**
 * A cross-platform frosted surface used when Apple's native glass API is not
 * available. Android uses a targeted native blur on API 31+ and a translucent
 * material fallback on older releases.
 */
export function GlassSurface({
  style,
  dark,
  clear = false,
  tint,
  children,
  ...rest
}: GlassSurfaceProps) {
  const blurTarget = useContext(GlassBlurTargetContext);
  const flatStyle = StyleSheet.flatten(style) ?? {};
  const blurProps =
    Platform.OS === "android" && blurTarget
      ? {
          blurTarget,
          blurMethod: "dimezisBlurViewSdk31Plus" as const,
          blurReductionFactor: 3.5,
        }
      : {};
  const highlight = clear ? 0.11 : 0.19;
  const shade = clear ? 0.06 : 0.12;

  return (
    <View {...rest} style={[styles.root, style, styles.clipped]}>
      <BlurView
        {...blurProps}
        intensity={Platform.OS === "android" ? 48 : 40}
        tint={dark ? "dark" : "light"}
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: flatStyle.borderRadius as number | undefined },
        ]}
      />
      <LinearGradient
        pointerEvents="none"
        colors={
          dark
            ? [
                `rgba(255,255,255,${highlight})`,
                "rgba(35,38,42,0.58)",
                `rgba(8,10,12,${shade + 0.22})`,
              ]
            : [
                `rgba(255,255,255,${0.74 - (clear ? 0.16 : 0)})`,
                "rgba(255,255,255,0.47)",
                `rgba(239,243,246,${0.36 - (clear ? 0.12 : 0)})`,
              ]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {tint ? (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: tint }]}
        />
      ) : null}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          styles.edge,
          {
            borderRadius: flatStyle.borderRadius as number | undefined,
            borderColor: dark
              ? "rgba(255,255,255,0.16)"
              : "rgba(255,255,255,0.74)",
          },
        ]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "relative",
  },
  clipped: {
    overflow: "hidden",
  },
  edge: {
    borderWidth: StyleSheet.hairlineWidth,
  },
});
