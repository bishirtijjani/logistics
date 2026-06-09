/**
 * NotificationCenterScreen - Phase 5 in-app notification feed.
 *
 * Reads from /notifications, live-updates via the `notification:new`
 * socket event, and deep-links to the relevant screen on tap.
 */

import React, { useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../../store/slices/notificationsSlice';
import { routeToScreen } from '../../lib/notificationRoute';
import EmptyState from '../../components/EmptyState';
import { useTheme } from '../../theme';

const ICON_BY_TYPE = {
  REQUEST_STATUS: 'cube-outline',
  ORDER: 'cube-outline',
  WALLET: 'wallet-outline',
  REFUND: 'cash-outline',
  PROMOTION: 'megaphone-outline',
  SYSTEM: 'information-circle-outline',
};

export default function NotificationCenterScreen() {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const { tokens } = useTheme();
  const { t, i18n } = useTranslation();
  const { list, isLoading, page, total, unreadCount } = useSelector((s) => s.notifications);

  const formatRelative = (iso) => {
    if (!iso) return '';
    const ms = Date.now() - new Date(iso).getTime();
    if (ms < 60_000) return t('wallet.tx.dateToday');
    if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
    if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h`;
    const tag = i18n.language === 'ha' ? 'ha-NG' : 'en-NG';
    return new Date(iso).toLocaleDateString(tag, { day: 'numeric', month: 'short' });
  };

  const loadFirst = useCallback(() => {
    dispatch(fetchNotifications({ page: 1, limit: 20 }));
  }, [dispatch]);

  useEffect(() => { loadFirst(); }, [loadFirst]);

  const onRefresh = () => loadFirst();

  const onEndReached = () => {
    if (isLoading) return;
    if (list.length >= total) return;
    dispatch(fetchNotifications({ page: page + 1, limit: 20 }));
  };

  const handlePress = (n) => {
    if (!n.readAt) dispatch(markNotificationRead(n.id));
    const action = routeToScreen(n);
    if (action) navigation.navigate(action.name, action.params);
  };

  const handleMarkAll = () => {
    if (unreadCount === 0) return;
    dispatch(markAllNotificationsRead());
  };

  const renderItem = ({ item }) => {
    const icon = ICON_BY_TYPE[item.type] || 'notifications-outline';
    const unread = !item.readAt;
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => handlePress(item)}
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          paddingVertical: 14,
          paddingHorizontal: 16,
          backgroundColor: unread ? tokens.brand.soft : tokens.bg.surface,
          borderBottomWidth: 1,
          borderBottomColor: tokens.border.default,
        }}
      >
        <View
          style={{
            width: 38, height: 38, borderRadius: 19, marginRight: 12,
            backgroundColor: unread ? tokens.brand.soft : tokens.bg.surfaceMuted,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons name={icon} size={20} color={unread ? tokens.brand.default : tokens.text.muted} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: tokens.text.primary, flex: 1 }} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={{ fontSize: 11, color: tokens.text.muted, marginLeft: 8 }}>
              {formatRelative(item.createdAt)}
            </Text>
          </View>
          <Text style={{ fontSize: 13, color: tokens.text.muted, marginTop: 3 }} numberOfLines={3}>
            {item.body}
          </Text>
        </View>
        {unread && (
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.brand.default, marginTop: 6, marginLeft: 6 }} />
        )}
      </TouchableOpacity>
    );
  };

  const renderEmpty = () =>
    isLoading ? null : (
      <EmptyState
        icon="notifications-off-outline"
        title={t('notificationCenter.empty')}
        subtitle={t('notificationCenter.emptyHint')}
        fill={false}
      />
    );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={['top']}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: 16, paddingVertical: 14,
          backgroundColor: tokens.bg.surface,
          borderBottomWidth: 1, borderBottomColor: tokens.border.default,
        }}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ padding: 6, marginRight: 4 }}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.back')}
        >
          <Ionicons name="arrow-back" size={22} color={tokens.text.primary} />
        </TouchableOpacity>
        <Text accessibilityRole="header" style={{ flex: 1, fontSize: 17, fontWeight: '800', color: tokens.text.primary }}>
          {t('notificationCenter.title')}
        </Text>
        <TouchableOpacity
          onPress={handleMarkAll}
          disabled={unreadCount === 0}
          accessibilityRole="button"
          accessibilityLabel={t('notificationCenter.markAllRead')}
          accessibilityState={{ disabled: unreadCount === 0 }}
        >
          <Text
            style={{
              fontSize: 13, fontWeight: '700',
              color: unreadCount === 0 ? tokens.text.muted : tokens.brand.default,
            }}
          >
            {t('notificationCenter.markAllRead')}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={list}
        keyExtractor={(n) => n.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={isLoading && page === 1}
            onRefresh={onRefresh}
            tintColor={tokens.brand.default}
          />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={
          isLoading && list.length > 0 ? (
            <ActivityIndicator color={tokens.brand.default} style={{ marginVertical: 16 }} />
          ) : null
        }
      />
    </SafeAreaView>
  );
}
