import React, { useContext } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useChatTheme } from '../theme';
import GlassBlurContext from '../GlassBlurContext';

export default function GlassSurface({
  children,
  style,
  tone = 'neutral',
  radius = 28,
  intensity,
}) {
  const theme = useChatTheme();
  const blurTarget = useContext(GlassBlurContext);
  const android = Platform.OS === 'android';
  const background = tone === 'outgoing' ? theme.outgoing : theme.incoming;
  const overlayColors =
    tone === 'outgoing'
      ? theme.mode === 'dark'
        ? ['rgba(211,231,238,0.18)', 'rgba(139,172,183,0.05)']
        : ['rgba(255,255,255,0.62)', 'rgba(205,224,229,0.35)']
      : theme.mode === 'dark'
        ? ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.025)']
        : ['rgba(255,255,255,0.66)', 'rgba(255,255,255,0.25)'];

  return (
    <View
      style={[
        styles.surface,
        {
          borderRadius: radius,
          backgroundColor: background,
          borderColor: theme.glassBorder,
        },
        style,
      ]}
    >
      <BlurView
        pointerEvents="none"
        tint={theme.mode === 'dark' ? 'dark' : 'light'}
        intensity={intensity ?? (android ? 34 : 62)}
        blurTarget={android ? blurTarget : undefined}
        blurMethod={android && blurTarget ? 'dimezisBlurViewSdk31Plus' : 'none'}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        pointerEvents="none"
        colors={overlayColors}
        start={{ x: 0.08, y: 0 }}
        end={{ x: 0.92, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={[
          styles.innerRim,
          { borderRadius: Math.max(0, radius - 1), borderColor: theme.glassBorder },
        ]}
      />
      <LinearGradient
        pointerEvents="none"
        colors={[
          theme.mode === 'dark' ? 'rgba(255,255,255,0.13)' : 'rgba(255,255,255,0.54)',
          'rgba(255,255,255,0)',
        ]}
        style={[styles.topSheen, { borderTopLeftRadius: radius, borderTopRightRadius: radius }]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#162421',
    shadowOpacity: Platform.OS === 'ios' ? 0.07 : 0,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: Platform.OS === 'android' ? 4 : 0,
  },
  innerRim: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: StyleSheet.hairlineWidth,
  },
  topSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 38,
  },
});
