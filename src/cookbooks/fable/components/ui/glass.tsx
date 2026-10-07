import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from "expo-glass-effect";
import type { ReactNode } from "react";
import {
  StyleSheet,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from "react-native";

import { GlassSurface } from "../../../shared/GlassSurface";
import { useScheme } from "../../hooks/use-theme";

export const GLASS =
  process.env.EXPO_OS === "ios" &&
  isGlassEffectAPIAvailable() &&
  isLiquidGlassAvailable();

type GlassProps = ViewProps & {
  style?: StyleProp<ViewStyle>;
  effect?: "regular" | "clear";
  tint?: string;
  interactive?: boolean;
  children?: ReactNode;
};

/**
 * Liquid glass surface on iOS 26+, a blurred translucent surface elsewhere.
 * Never give it opacity 0 — that silently disables the glass.
 */
export function Glass({
  style,
  effect = "regular",
  tint,
  interactive = false,
  children,
  ...rest
}: GlassProps) {
  const scheme = useScheme();
  if (GLASS) {
    return (
      <GlassView
        colorScheme={scheme}
        glassEffectStyle={effect}
        tintColor={tint}
        isInteractive={interactive}
        style={[styles.base, style]}
        {...rest}
      >
        {children}
      </GlassView>
    );
  }
  return (
    <GlassSurface
      dark={scheme === "dark"}
      clear={effect === "clear"}
      tint={tint}
      style={[styles.base, style]}
      {...rest}
    >
      {children}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  base: {
    borderCurve: "continuous",
  },
});
