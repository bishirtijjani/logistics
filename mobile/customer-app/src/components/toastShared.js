// Shared themed toast renderer + config builder.
//
// Two consumers:
//   1. App.js's ThemedToast — the root toast, wrapped in its own Modal.
//   2. InModalToast (below) — mounted INSIDE each RN-<Modal>-based sheet so
//      toast.show() calls fired while that sheet is open still paint above it
//      (RN Modals stack in open-order on Android; a Modal opened after the
//      root would otherwise cover the root toast).
//
// react-native-toast-message v2 uses a singleton ref that the most recently
// mounted <Toast /> instance owns. When a sheet's <InModalToast /> mounts it
// takes over; when it unmounts, the root <Toast /> regains it. That's exactly
// the behavior we want — no per-call routing required.

import React, { useMemo, useRef } from "react";
import {
  Animated,
  Dimensions,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import { useTheme } from "../theme";

const SCREEN_W = Dimensions.get("window").width;
const SWIPE_DISMISS_THRESHOLD = 80;

function SwipeablePill({ bg, text1, text2, baseContainer, textBase, subTextBase }) {
  const translateX = useRef(new Animated.Value(0)).current;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderMove: Animated.event([null, { dx: translateX }], {
          useNativeDriver: false,
        }),
        onPanResponderRelease: (_, g) => {
          if (Math.abs(g.dx) > SWIPE_DISMISS_THRESHOLD) {
            Animated.timing(translateX, {
              toValue: g.dx > 0 ? SCREEN_W : -SCREEN_W,
              duration: 180,
              useNativeDriver: true,
            }).start(() => {
              Toast.hide();
              translateX.setValue(0);
            });
          } else {
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 6,
            }).start();
          }
        },
      }),
    [translateX]
  );

  const opacity = translateX.interpolate({
    inputRange: [-SCREEN_W, 0, SCREEN_W],
    outputRange: [0, 1, 0],
    extrapolate: "clamp",
  });

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        baseContainer,
        { backgroundColor: bg, transform: [{ translateX }], opacity },
      ]}
    >
      <Text style={textBase}>{text1}</Text>
      {text2 ? <Text style={subTextBase}>{text2}</Text> : null}
    </Animated.View>
  );
}

export function useToastConfig() {
  const { tokens } = useTheme();
  return useMemo(() => {
    const baseContainer = {
      paddingHorizontal: 20,
      paddingVertical: 14,
      marginHorizontal: 12,
      borderRadius: 12,
    };
    const textBase = {
      fontSize: 16,
      fontWeight: "600",
      color: "#FFFFFF",
    };
    const subTextBase = {
      fontSize: 14,
      color: "#FFFFFF",
      marginTop: 4,
      opacity: 0.95,
    };
    const make = (bg) => (props) =>
      (
        <SwipeablePill
          bg={bg}
          text1={props.text1}
          text2={props.text2}
          baseContainer={baseContainer}
          textBase={textBase}
          subTextBase={subTextBase}
        />
      );
    return {
      success: make(tokens.status.success),
      error: make(tokens.status.error),
      info: make(tokens.status.info),
    };
  }, [tokens]);
}

// Drop this as the LAST child inside any RN-Modal-based sheet so toast.show()
// calls made while the sheet is open still render above it. Renders nothing
// outside of an active toast — safe to mount everywhere.
export function InModalToast() {
  const toastConfig = useToastConfig();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Toast config={toastConfig} />
    </View>
  );
}
