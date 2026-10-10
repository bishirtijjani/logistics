/**
 * ErrorState - the placeholder a list renders when its fetch failed.
 *
 * Renders a red glyph, a localized title, the server-supplied message as a
 * secondary line, and a "Try again" button. Pair with the `tError(err)`
 * helper from `i18n/useT.js` so the error code lookup happens at the call
 * site, not here.
 *
 * Usage:
 *   const { t, tError } = useT();
 *   ...
 *   if (error) return <ErrorState message={tError(error)} onRetry={refetch} />;
 */

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme';

const ErrorState = ({
  title,
  message,
  onRetry,
  // Pass-through icon name; default conveys "trouble" without being alarming.
  icon = 'cloud-offline-outline',
  fill = true,
}) => {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);
  const resolvedTitle = title || t('states.errorTitle');
  const retryLabel = t('common.retry');

  return (
    <View
      style={[styles.wrap, fill && { flex: 1 }]}
      accessible
      accessibilityLabel={`${resolvedTitle}. ${message || ''}`.trim()}
    >
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={28} color={tokens.status.error} />
      </View>
      <Text style={styles.title}>{resolvedTitle}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {onRetry ? (
        <TouchableOpacity
          onPress={onRetry}
          style={styles.retry}
          accessibilityRole="button"
          accessibilityLabel={retryLabel}
        >
          <Ionicons name="refresh" size={16} color={tokens.brand.default} />
          <Text style={styles.retryText}>{retryLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const makeStyles = (tokens) => StyleSheet.create({
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
    backgroundColor: tokens.status.errorSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.text.primary,
    textAlign: 'center',
    marginBottom: 4,
  },
  message: {
    fontSize: 13,
    color: tokens.text.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
  retry: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: tokens.brand.default,
    gap: 6,
  },
  retryText: {
    color: tokens.brand.default,
    fontWeight: '700',
    fontSize: 13,
  },
});

export default ErrorState;
