import React from 'react';
import { StyleSheet, View } from 'react-native';

export default function ChatIcon({ name, size = 24, color = '#191B1D' }) {
  const stroke = Math.max(1.7, size * 0.085);
  const line = { position: 'absolute', backgroundColor: color, borderRadius: stroke };

  if (name === 'back') {
    return (
      <View style={{ width: size, height: size }}>
        <View
          style={[
            line,
            {
              width: size * 0.43,
              height: stroke,
              left: size * 0.2,
              top: size * 0.34,
              transform: [{ rotate: '-45deg' }],
            },
          ]}
        />
        <View
          style={[
            line,
            {
              width: size * 0.43,
              height: stroke,
              left: size * 0.2,
              top: size * 0.62,
              transform: [{ rotate: '45deg' }],
            },
          ]}
        />
      </View>
    );
  }

  if (name === 'more') {
    const dot = Math.max(3.5, size * 0.17);
    return (
      <View style={[styles.dots, { width: size * 0.66, height: dot }]}>
        {[0, 1, 2].map((item) => (
          <View
            key={item}
            style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: color }}
          />
        ))}
      </View>
    );
  }

  if (name === 'plus') {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <View
          style={[
            line,
            { width: size * 0.62, height: stroke, left: size * 0.19, top: (size - stroke) / 2 },
          ]}
        />
        <View
          style={[
            line,
            { width: stroke, height: size * 0.62, left: (size - stroke) / 2, top: size * 0.19 },
          ]}
        />
      </View>
    );
  }

  if (name === 'close') {
    return (
      <View style={{ width: size, height: size }}>
        <View
          style={[
            line,
            {
              width: size * 0.62,
              height: stroke,
              left: size * 0.19,
              top: size * 0.48,
              transform: [{ rotate: '45deg' }],
            },
          ]}
        />
        <View
          style={[
            line,
            {
              width: size * 0.62,
              height: stroke,
              left: size * 0.19,
              top: size * 0.48,
              transform: [{ rotate: '-45deg' }],
            },
          ]}
        />
      </View>
    );
  }

  const arrow = (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          line,
          { width: stroke, height: size * 0.61, left: (size - stroke) / 2, top: size * 0.22 },
        ]}
      />
      <View
        style={[
          line,
          {
            width: size * 0.37,
            height: stroke,
            left: size * 0.17,
            top: size * 0.29,
            transform: [{ rotate: '-45deg' }],
          },
        ]}
      />
      <View
        style={[
          line,
          {
            width: size * 0.37,
            height: stroke,
            right: size * 0.17,
            top: size * 0.29,
            transform: [{ rotate: '45deg' }],
          },
        ]}
      />
    </View>
  );

  if (name === 'send-circle') {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <View
          style={{
            position: 'absolute',
            width: size * 0.9,
            height: size * 0.9,
            borderRadius: size,
            borderWidth: stroke,
            borderColor: color,
          }}
        />
        <View style={{ transform: [{ scale: 0.55 }] }}>{arrow}</View>
      </View>
    );
  }

  return arrow;
}

const styles = StyleSheet.create({
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
