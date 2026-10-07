import {
  SymbolView,
  type AndroidSymbol,
  type SymbolViewProps,
} from "expo-symbols";

const ANDROID_SYMBOLS: Record<string, AndroidSymbol> = {
  "arrow.counterclockwise": "undo",
  "arrow.up": "arrow_upward",
  "arrow.up.right": "north_east",
  "bell.slash.fill": "notifications_off",
  "bubble.left.and.bubble.right": "forum",
  "chevron.down": "keyboard_arrow_down",
  "chevron.left": "chevron_left",
  "chevron.right": "chevron_right",
  ellipsis: "more_horiz",
  heart: "favorite_border",
  "heart.fill": "favorite",
  magnifyingglass: "search",
  "mic.fill": "mic",
  plus: "add",
  video: "videocam",
  xmark: "close",
  "xmark.circle.fill": "cancel",
};

/**
 * Keeps SF Symbols on Apple platforms while resolving each app icon to a
 * Material Symbol on Android and web. The explicit fallback prevents an
 * unmapped SF Symbol from silently rendering as an empty view off iOS.
 */
export function PlatformSymbol({ name, ...props }: SymbolViewProps) {
  const platformName =
    typeof name === "string"
      ? {
          ios: name,
          android: ANDROID_SYMBOLS[name] ?? "help",
          web: ANDROID_SYMBOLS[name] ?? "help",
        }
      : name;

  return <SymbolView {...props} name={platformName} />;
}
