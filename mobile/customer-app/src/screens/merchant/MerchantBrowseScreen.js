/**
 * MerchantBrowseScreen — Browse merchants (restaurants, grocery stores, pharmacies)
 * Part of the unified request architecture
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import api from '../../services/api';
import { colors } from '../../theme';
import SkeletonLoader from '../../components/SkeletonLoader';
import EmptyState from '../../components/EmptyState';

const MerchantBrowseScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { t } = useTranslation();
  const { categorySlug, categoryName, lat, lng } = route.params;

  const [merchants, setMerchants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMerchants = async () => {
    try {
      const params = new URLSearchParams();
      if (categorySlug) params.append('categorySlug', categorySlug);
      if (lat && lng) {
        params.append('lat', lat);
        params.append('lng', lng);
        params.append('radius', '10');
      }
      params.append('openNow', 'true');

      const response = await api.get(`/merchants?${params.toString()}`);
      setMerchants(response?.data || []);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: t('errors.title'),
        text2: error.message,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMerchants();
  }, [categorySlug, lat, lng]); // eslint-disable-line

  const onRefresh = () => {
    setRefreshing(true);
    fetchMerchants();
  };

  const headerLabel = categoryName || t('merchant.browseFallbackHeader');

  const renderMerchant = ({ item }) => (
    <TouchableOpacity
      style={styles.merchantCard}
      onPress={() => navigation.navigate('MerchantMenu', { merchantId: item.id, categorySlug })}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}. ${item.isOpen ? t('merchant.openNow') : t('merchant.closed')}`}
      accessibilityHint={item.address}
    >
      <Image
        source={{ uri: item.coverImageUrl || 'https://via.placeholder.com/400x200' }}
        style={styles.coverImage}
      />
      <View style={styles.merchantInfo}>
        <View style={styles.headerRow}>
          <Image
            source={{ uri: item.logoUrl || 'https://via.placeholder.com/50' }}
            style={styles.logo}
          />
          <View style={styles.nameContainer}>
            <Text style={styles.name}>{item.name}</Text>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={14} color="#FFA500" />
              <Text style={styles.rating}>{item.averageRating.toFixed(1)}</Text>
              <Text style={styles.orderCount}>{t('merchant.ordersCount', { count: item.totalOrders })}</Text>
            </View>
          </View>
          {item.isOpen ? (
            <View style={styles.openBadge}>
              <Text style={styles.openText}>{t('merchant.openNow')}</Text>
            </View>
          ) : (
            <View style={styles.closedBadge}>
              <Text style={styles.closedText}>{t('merchant.closed')}</Text>
            </View>
          )}
        </View>
        <Text style={styles.address} numberOfLines={1}>
          {item.address}
        </Text>
        <View style={styles.footerRow}>
          <Text style={styles.type}>{item.category?.name || ''}</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text accessibilityRole="header" style={styles.headerTitle}>{headerLabel}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={{ padding: 16 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonLoader.MerchantCard key={i} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.back')}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text accessibilityRole="header" style={styles.headerTitle}>{headerLabel}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={merchants}
        renderItem={renderMerchant}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState
            icon="storefront-outline"
            title={t('merchant.noMerchantsTitle', { category: headerLabel })}
            subtitle={t('merchant.noMerchantsHint')}
            fill={false}
          />
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      />
    </View>
  );
};

const styles = {
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  merchantCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  coverImage: {
    width: '100%',
    height: 120,
    resizeMode: 'cover',
  },
  merchantInfo: {
    padding: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 12,
  },
  nameContainer: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text,
    marginLeft: 4,
  },
  orderCount: {
    fontSize: 12,
    color: colors.textMuted,
    marginLeft: 4,
  },
  openBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  openText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  closedBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  closedText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  address: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 8,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  type: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },
};

export default MerchantBrowseScreen;
