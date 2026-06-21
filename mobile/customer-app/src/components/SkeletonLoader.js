/**
 * SkeletonLoader - pulsing-grey placeholder for content that is loading.
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

import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';

const Shimmer = ({ style }) => {
  const { tokens } = useTheme();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);
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
  const { tokens } = useTheme();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);
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
  const { tokens } = useTheme();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);
  return (
    <View style={styles.merchantCard}>
      <SkeletonLoader width="100%" height={140} radius={0} />
      <View style={styles.merchantCardInfo}>
        <SkeletonLoader width={48} height={48} radius={12} style={{ marginRight: 12 }} />
        <View style={{ flex: 1 }}>
          <SkeletonLoader width="60%" height={15} style={{ marginBottom: 7 }} />
          <SkeletonLoader width="40%" height={12} style={{ marginBottom: 7 }} />
          <SkeletonLoader width="75%" height={12} />
        </View>
      </View>
    </View>
  );
};

/** A line in the wallet history list. */
SkeletonLoader.TransactionRow = function TransactionRow() {
  const { tokens } = useTheme();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);
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

const makeStyles = (tokens) => StyleSheet.create({
  base: {
    backgroundColor: tokens.border.default,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: tokens.bg.surface,
    borderRadius: 14,
    marginBottom: 10,
  },
  merchantCard: {
    backgroundColor: tokens.bg.surface,
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: tokens.border.subtle,
  },
  merchantCardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
});

export default SkeletonLoader;
