import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useChatTheme } from '../theme';

const miraPortrait = require('../../assets/mira.jpg');

export default function ContactAvatar({ size = 50, online = false, style }) {
  const theme = useChatTheme();
  return (
    <View
      style={[
        styles.frame,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        style,
      ]}
    >
      <Image
        source={miraPortrait}
        resizeMode="cover"
        accessibilityLabel="Mira Ellis"
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
      {online && (
        <View
          style={[
            styles.onlineDot,
            {
              width: Math.max(10, size * 0.22),
              height: Math.max(10, size * 0.22),
              borderRadius: size * 0.11,
              borderColor: theme.background,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'visible',
    backgroundColor: '#D8DEDA',
    shadowColor: '#17211F',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  onlineDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    backgroundColor: '#739B86',
    borderWidth: 2,
    borderColor: '#F1F2F1',
  },
});
