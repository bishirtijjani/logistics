import React, { useEffect, useRef, useState } from "react";
import { View, Text, Animated } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "../theme";
import { serverNow } from "../services/api";

/**
 * Animated countdown ring for the JobOfferScreen.
 *
 * Visuals:
 *   - Outer ring depletes clockwise from full to empty over the offer TTL.
 *   - Color band shifts from brand orange → amber (< 20 s) → red (< 10 s).
 *   - Large numeric countdown at the centre.
 *
 * Uses `offeredAt` (server clock-ish) so a backgrounded → foregrounded app
 * resumes with the correct remaining time instead of restarting from 60.
 */
const SIZE = 180;
const STROKE_WIDTH = 12;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const TICK_MS = 250;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function OfferCountdownRing({ offeredAt, ttlSeconds = 60, onExpire }) {
  const { tokens } = useTheme();
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.ceil((offeredAt + ttlSeconds * 1000 - serverNow()) / 1000)),
  );
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  useEffect(() => { onExpireRef.current = onExpire; }, [onExpire]);

  useEffect(() => {
    const tick = () => {
      const remainingMs = Math.max(0, offeredAt + ttlSeconds * 1000 - serverNow());
      const remainingSec = Math.ceil(remainingMs / 1000);
      setSecondsLeft(remainingSec);
      if (remainingMs <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        try { onExpireRef.current?.(); } catch (_) {}
      }
    };
    tick();
    const id = setInterval(tick, TICK_MS);
    return () => clearInterval(id);
  }, [offeredAt, ttlSeconds]);

  const fraction = Math.max(0, Math.min(1, secondsLeft / ttlSeconds));
  const strokeDashoffset = CIRCUMFERENCE * (1 - fraction);

  let ringColor;
  if (secondsLeft <= 10) ringColor = tokens.status.error;
  else if (secondsLeft <= 20) ringColor = tokens.status.warningStrong;
  else ringColor = tokens.brand.default;

  return (
    <View
      style={{
        width: SIZE,
        height: SIZE,
        alignItems: "center",
        justifyContent: "center",
      }}
      accessibilityRole="timer"
      accessibilityLabel={`${secondsLeft} seconds remaining`}
    >
      <Svg width={SIZE} height={SIZE}>
        {/* Track */}
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={tokens.bg.surfaceMuted}
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />
        {/* Progress — start from 12 o'clock and sweep clockwise */}
        <AnimatedCircle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={ringColor}
          strokeWidth={STROKE_WIDTH}
          fill="none"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </Svg>
      <View style={{ position: "absolute", alignItems: "center" }}>
        <Text
          style={{
            fontSize: 52,
            fontWeight: "900",
            color: tokens.text.primary,
            letterSpacing: -2,
            lineHeight: 56,
          }}
        >
          {secondsLeft}
        </Text>
        <Text style={{ fontSize: 11, fontWeight: "700", color: tokens.text.muted, letterSpacing: 1 }}>
          SECONDS
        </Text>
      </View>
    </View>
  );
}
