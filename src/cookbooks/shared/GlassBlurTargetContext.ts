import { createContext, type RefObject } from "react";
import type { View } from "react-native";

export const GlassBlurTargetContext =
  createContext<RefObject<View | null> | null>(null);
