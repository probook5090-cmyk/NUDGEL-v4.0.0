import React, { useEffect, useRef } from 'react';
import { Animated, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useChatTheme } from '../theme';
import ContactAvatar from './ContactAvatar';
import GlassSurface from './GlassSurface';

const coastPhoto = require('../../assets/coast.jpg');

export default function ChatBubble({ item, width, onLongPress, onPhotoPress, onReactionPress }) {
  const theme = useChatTheme();
  const appear = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  const mine = item.mine;
  const photoWidth = Math.min(width * 0.75, 360);
  const photoHeight = photoWidth / 1.46;
  const showAvatar = !mine && item.showAvatar;

  useEffect(() => {
    Animated.spring(appear, {
      toValue: 1,
      speed: 19,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  }, [appear]);

  const enterStyle = {
    opacity: appear,
    transform: [
      {
        translateY: appear.interpolate({
          inputRange: [0, 1],
          outputRange: [9, 0],
        }),
      },
      {
        scale: appear.interpolate({
          inputRange: [0, 1],
          outputRange: [0.985, 1],
        }),
      },
      { scale: pressScale },
    ],
  };

  const photoMessage = item.type === 'photo';
  const bubbleWidth = photoMessage ? photoWidth : width * 0.78;

  return (
    <View
      style={[
        styles.row,
        {
          justifyContent: mine ? 'flex-end' : 'flex-start',
          marginBottom: photoMessage ? 21 : 17,
        },
      ]}
    >
      {!mine && (
        <View style={styles.avatarSlot}>{showAvatar ? <ContactAvatar size={28} /> : null}</View>
      )}

      <Animated.View
        style={[
          styles.bubbleColumn,
          { maxWidth: bubbleMessageWidth(bubbleWidth, width) },
          enterStyle,
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={photoMessage ? 'Open shared coastal photo' : item.text}
          onLongPress={() => onLongPress(item.id)}
          delayLongPress={320}
          onPress={photoMessage ? onPhotoPress : undefined}
          onPressIn={() => {
            Animated.spring(pressScale, {
              toValue: 0.985,
              speed: 30,
              bounciness: 0,
              useNativeDriver: true,
            }).start();
          }}
          onPressOut={() => {
            Animated.spring(pressScale, {
              toValue: 1,
              speed: 24,
              bounciness: 2,
              useNativeDriver: true,
            }).start();
          }}
        >
          {photoMessage ? (
            <View
              style={[
                styles.photoCard,
                {
                  width: photoWidth,
                  height: photoHeight,
                  borderRadius: 32,
                  borderColor: theme.glassBorder,
                },
              ]}
            >
              <Image source={coastPhoto} resizeMode="cover" style={StyleSheet.absoluteFill} />
              <BlurView
                pointerEvents="none"
                tint={theme.mode === 'dark' ? 'dark' : 'light'}
                intensity={Platform.OS === 'ios' ? 7 : 2}
                blurMethod="none"
                style={StyleSheet.absoluteFill}
              />
              <LinearGradient
                pointerEvents="none"
                colors={[
                  'rgba(255,255,255,0.38)',
                  'rgba(255,255,255,0.015)',
                  theme.mode === 'dark' ? 'rgba(0,0,0,0.26)' : 'rgba(10,20,20,0.15)',
                ]}
                locations={[0, 0.46, 1]}
                start={{ x: 0.15, y: 0 }}
                end={{ x: 0.85, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <LinearGradient
                pointerEvents="none"
                colors={['rgba(255,255,255,0.62)', 'rgba(255,255,255,0.02)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.photoReflection}
              />
              <View
                pointerEvents="none"
                style={[
                  styles.photoRim,
                  {
                    borderColor:
                      theme.mode === 'dark' ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.72)',
                  },
                ]}
              />
              <View style={styles.photoCaptionPosition}>
                <GlassSurface tone="neutral" radius={20} intensity={22} style={styles.photoCaption}>
                  <Text style={styles.photoCaptionText}>
                    {item.caption || 'A place to disappear'}
                  </Text>
                </GlassSurface>
              </View>
            </View>
          ) : (
            <GlassSurface
              tone={mine ? 'outgoing' : 'neutral'}
              radius={27}
              style={[
                styles.textBubble,
                {
                  maxWidth: width * 0.78,
                  borderBottomRightRadius: mine ? 15 : 27,
                  borderBottomLeftRadius: mine ? 27 : 15,
                },
              ]}
            >
              <Text style={[styles.messageText, { color: theme.text }]}>{item.text}</Text>
            </GlassSurface>
          )}
        </Pressable>

        {item.reaction ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove heart reaction"
            onPress={() => onReactionPress(item.id)}
            style={[styles.reactionPosition, mine ? styles.reactionMine : styles.reactionIncoming]}
          >
            <GlassSurface radius={16} style={styles.reactionPill}>
              <Text style={styles.reactionText}>❤️</Text>
            </GlassSurface>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}

function bubbleMessageWidth(bubbleWidth, screenWidth) {
  return Math.min(bubbleWidth, screenWidth - 76);
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  avatarSlot: {
    width: 29,
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 3,
  },
  bubbleColumn: {
    position: 'relative',
    alignSelf: 'flex-end',
  },
  textBubble: {
    paddingHorizontal: 18,
    paddingVertical: 13,
    minHeight: 50,
    justifyContent: 'center',
    shadowOpacity: 0.045,
    elevation: 2,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.22,
    fontWeight: '400',
  },
  photoCard: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#AAB4AF',
    borderWidth: 1,
    shadowColor: '#14201D',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 9 },
    elevation: 5,
  },
  photoReflection: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '85%',
    height: '50%',
    opacity: 0.82,
  },
  photoRim: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderRadius: 31,
  },
  photoCaptionPosition: {
    position: 'absolute',
    left: 14,
    bottom: 13,
  },
  photoCaption: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 20,
  },
  photoCaptionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.1,
    textShadowColor: 'rgba(20,28,27,0.35)',
    textShadowRadius: 6,
  },
  reactionPosition: {
    position: 'absolute',
    bottom: -13,
  },
  reactionMine: {
    right: 12,
  },
  reactionIncoming: {
    right: 12,
  },
  reactionPill: {
    minWidth: 34,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  reactionText: {
    fontSize: 14,
  },
});
