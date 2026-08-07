/**
 * Non-blocking nudge to rate a recently-delivered order. Shown at most once
 * per Home visit (see lib/ratingPrompt), and dismissible with a single tap -
 * no confirmation dialog, no repeat asking for that order.
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme';

export default function RateOrderBanner({ request, onRate, onDismiss }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  if (!request) return null;

  const merchantName = request.merchant?.name || (request.type === 'PACKAGE' ? t('home.active.packageFallback') : t('home.active.orderFallback'));

  return (
    <View
      style={{
        marginHorizontal: 20,
        marginTop: 14,
        backgroundColor: tokens.bg.surface,
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: tokens.border.default,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <View
        style={{
          width: 44, height: 44, borderRadius: 22,
          backgroundColor: '#FFA50022',
          alignItems: 'center', justifyContent: 'center', marginRight: 12,
        }}
      >
        <Ionicons name="star" size={20} color="#FFA500" />
      </View>
      <TouchableOpacity
        style={{ flex: 1 }}
        onPress={onRate}
        accessibilityRole="button"
        accessibilityLabel={t('rate.bannerCta', { name: merchantName })}
      >
        <Text style={{ fontSize: 14, fontWeight: '800', color: tokens.text.primary }}>
          {t('rate.bannerTitle')}
        </Text>
        <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12, color: tokens.text.muted }}>
          {t('rate.bannerSubtitle', { name: merchantName })}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onRate}
        accessibilityRole="button"
        accessibilityLabel={t('rate.bannerCta', { name: merchantName })}
        style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: tokens.brand.default, marginRight: 8 }}
      >
        <Text style={{ color: tokens.text.onBrand, fontWeight: '800', fontSize: 12 }}>{t('rate.bannerRate')}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel={t('rate.bannerDismiss')}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="close" size={18} color={tokens.text.muted} />
      </TouchableOpacity>
    </View>
  );
}
