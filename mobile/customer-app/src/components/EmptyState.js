/**
 * EmptyState — the placeholder a list renders when it has 0 rows.
 *
 * Three pieces, vertically stacked: an Ionicons glyph, a bold title, a
 * one-line muted subtitle. Optional CTA button below for "go do this thing
 * to fill this list" prompts.
 *
 * Standardizes empty-list copy across the app and makes the difference
 * between "loading", "empty", and "errored" visually obvious — three states
 * that frequently get conflated.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

const EmptyState = ({
  icon = 'archive-outline',
  title,
  subtitle,
  ctaLabel,
  onCta,
  // Keep the layout vertically centered when the parent gives us all the
  // remaining flex; otherwise just stack from the top.
  fill = true,
  // Optional accessibility role override; default is "summary" so a screen
  // reader announces the whole block as one piece of content.
  accessibilityLabel,
}) => (
  <View
    style={[styles.wrap, fill && { flex: 1 }]}
    accessible
    accessibilityLabel={accessibilityLabel || `${title}. ${subtitle || ''}`.trim()}
  >
    <View style={styles.iconWrap}>
      <Ionicons name={icon} size={28} color={colors.textMuted} />
    </View>
    <Text style={styles.title}>{title}</Text>
    {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    {ctaLabel && onCta ? (
      <TouchableOpacity
        onPress={onCta}
        style={styles.cta}
        accessibilityRole="button"
        accessibilityLabel={ctaLabel}
      >
        <Text style={styles.ctaText}>{ctaLabel}</Text>
      </TouchableOpacity>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  cta: {
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  ctaText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
});

export default EmptyState;
