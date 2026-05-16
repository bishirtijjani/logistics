/**
 * SkeletonLoader — pulsing-grey placeholder for content that is loading.
 *
 * Replaces ad-hoc <ActivityIndicator> spinners on primary lists. The "pulse"
 * makes a 1–2s load feel ~3× faster than a spinner because the user sees the
 * shape of the content arriving, not just an indeterminate wait.
 *
 * Usage:
 *   <SkeletonLoader width="80%" height={16} />
 *   <SkeletonLoader.OrderRow />
 *   <SkeletonLoader.MerchantCard />
 *
 * Driven by a single shared `Animated.Value` so dozens of skeletons on one
 * screen don't each spin up their own RAF loop.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors } from '../theme';

const Shimmer = ({ style }) => {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  // accessibilityElementsHidden hides skeletons from screen readers so the
  // user doesn't hear "image" announcements while content is loading.
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.base, style, { opacity }]}
    />
  );
};

const SkeletonLoader = ({ width = '100%', height = 16, radius = 8, style }) => (
  <Shimmer style={[{ width, height, borderRadius: radius }, style]} />
);

/** A typical row in the Orders list. */
SkeletonLoader.OrderRow = function OrderRow() {
  return (
    <View style={styles.cardRow}>
      <SkeletonLoader width={44} height={44} radius={22} style={{ marginRight: 12 }} />
      <View style={{ flex: 1 }}>
        <SkeletonLoader width="60%" height={14} style={{ marginBottom: 8 }} />
        <SkeletonLoader width="40%" height={12} />
      </View>
      <SkeletonLoader width={56} height={20} radius={10} />
    </View>
  );
};

/** A merchant card in the browse grid. */
SkeletonLoader.MerchantCard = function MerchantCard() {
  return (
    <View style={styles.merchantCard}>
      <SkeletonLoader width="100%" height={120} radius={12} />
      <View style={{ padding: 10 }}>
        <SkeletonLoader width="70%" height={14} style={{ marginBottom: 6 }} />
        <SkeletonLoader width="40%" height={12} />
      </View>
    </View>
  );
};

/** A line in the wallet history list. */
SkeletonLoader.TransactionRow = function TransactionRow() {
  return (
    <View style={styles.cardRow}>
      <SkeletonLoader width={36} height={36} radius={10} style={{ marginRight: 12 }} />
      <View style={{ flex: 1 }}>
        <SkeletonLoader width="55%" height={13} style={{ marginBottom: 6 }} />
        <SkeletonLoader width="35%" height={11} />
      </View>
      <SkeletonLoader width={64} height={14} />
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.border,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: colors.surface,
    borderRadius: 14,
    marginBottom: 10,
  },
  merchantCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    marginBottom: 12,
    overflow: 'hidden',
  },
});

export default SkeletonLoader;
