import React, { useMemo } from "react";
import { View, StyleSheet, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme";

// Subtle full-app gift-icon watermark. Mounted once at the App root as a
// non-interactive overlay (pointerEvents="none") so taps pass through. Each
// screen still owns its own opaque background; the icons ride on top at low
// opacity in the brand orange so they read as a background pattern rather than
// a foreground overlay.
const TILE_X = 96;
const TILE_Y = 96;
const ICON_SIZE = 22;

export default function BackgroundPattern() {
  const { isDark, tokens } = useTheme();
  const { width, height } = useWindowDimensions();

  const cells = useMemo(() => {
    const cols = Math.ceil(width / TILE_X) + 1;
    const rows = Math.ceil(height / TILE_Y) + 1;
    const arr = [];
    for (let r = 0; r < rows; r++) {
      // Stagger every other row so it doesn't look like a strict grid.
      const offset = r % 2 === 0 ? 0 : TILE_X / 2;
      for (let c = 0; c < cols; c++) {
        arr.push({
          left: c * TILE_X + offset,
          top: r * TILE_Y,
          rot: ((r + c) % 3 - 1) * 12, // -12°, 0°, +12°
        });
      }
    }
    return arr;
  }, [width, height]);

  const color = tokens.brand.default;
  const opacity = isDark ? 0.14 : 0.10;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {cells.map((d, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            left: d.left,
            top: d.top,
            opacity,
            transform: [{ rotate: `${d.rot}deg` }],
          }}
        >
          <Ionicons name="gift" size={ICON_SIZE} color={color} />
        </View>
      ))}
    </View>
  );
}
