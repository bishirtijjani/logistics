/**
 * MerchantBrowseScreen - Browse merchants (restaurants, grocery stores, pharmacies)
 * Part of the unified request architecture
 */

import React, { useState, useEffect, useMemo } from 'react';
import { goBackOr } from "../../lib/goBack";
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import api from '../../services/api';
import { useTheme } from '../../theme';
import SkeletonLoader from '../../components/SkeletonLoader';
import EmptyState from '../../components/EmptyState';
import SearchModal from '../../components/SearchModal';

const MerchantBrowseScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);
  const [searchVisible, setSearchVisible] = useState(false);
  // route.params is undefined when entered from the "Start an order" CTA on
  // OrdersScreen (no category context); HomeScreen / ShopsScreen do pass them.
  // The screen treats every field as optional, so a missing params bag is fine.
  const { categorySlug, categoryName, lat, lng } = route.params || {};

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
      // Intentionally NOT filtering by openNow: closed merchants are still shown
      // (dimmed, with a "Closed" badge) so customers can browse menus and see who
      // exists, instead of an empty list outside business hours. Open shops sort
      // first so they stay the primary call to action.
      const response = await api.get(`/merchants?${params.toString()}`);
      const list = response?.data || [];
      setMerchants(
        [...list].sort((a, b) => Number(b.isOpen) - Number(a.isOpen))
      );
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
  const searchPlaceholder = categoryName
    ? t('search.scopedPh', { category: categoryName })
    : t('search.ph');

  // Floating header: circular back button (left) + category name (top-right) on
  // one row, with the search bar centered full-width below. Tapping the bar opens
  // the unified search scoped to THIS category and the user's location.
  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <View style={styles.headerTopRow}>
        <TouchableOpacity
          onPress={() => goBackOr(navigation)}
          style={styles.backCircle}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.back')}
        >
          <Ionicons name="arrow-back" size={22} color={tokens.text.primary} />
        </TouchableOpacity>
        <Text accessibilityRole="header" style={styles.categoryLabel} numberOfLines={1}>
          {headerLabel}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => setSearchVisible(true)}
        activeOpacity={0.8}
        accessibilityRole="search"
        accessibilityLabel={searchPlaceholder}
        style={styles.searchPill}
      >
        <Ionicons name="search" size={18} color={tokens.text.muted} />
        <Text numberOfLines={1} style={styles.searchPillText}>{searchPlaceholder}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderMerchant = ({ item }) => (
    <TouchableOpacity
      style={[styles.merchantCard, !item.isOpen && styles.merchantCardClosed]}
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
          <Ionicons name="chevron-forward" size={20} color={tokens.text.muted} />
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {renderHeader()}

      {loading ? (
        <View style={{ padding: 16 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonLoader.MerchantCard key={i} />
          ))}
        </View>
      ) : (
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
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.brand.default} />
          }
        />
      )}

      <SearchModal
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        onNavigate={(name, params) => navigation.navigate(name, params)}
        categorySlug={categorySlug || null}
        categoryName={categoryName || null}
      />
    </View>
  );
};

const makeStyles = (tokens) => ({
  container: {
    flex: 1,
    backgroundColor: tokens.bg.canvas,
  },
  // Floating header sits on the canvas (no solid bar / bottom border); the back
  // button and search pill are the only elevated surfaces, so they read as
  // floating chips.
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: tokens.bg.canvas,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backCircle: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.bg.surface,
    borderWidth: 1,
    borderColor: tokens.border.default,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  categoryLabel: {
    flexShrink: 1,
    maxWidth: '60%',
    textAlign: 'right',
    fontSize: 16,
    fontWeight: '800',
    color: tokens.text.primary,
    letterSpacing: -0.3,
    marginLeft: 12,
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.bg.surface,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: tokens.border.default,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 1,
  },
  searchPillText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    fontWeight: '500',
    color: tokens.text.muted,
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
    backgroundColor: tokens.bg.surface,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  // Closed merchants stay visible but dimmed so they read as inactive while the
  // open ones (sorted first) remain the primary choice.
  merchantCardClosed: {
    opacity: 0.55,
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
    color: tokens.text.primary,
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    fontSize: 12,
    fontWeight: '500',
    color: tokens.text.primary,
    marginLeft: 4,
  },
  orderCount: {
    fontSize: 12,
    color: tokens.text.muted,
    marginLeft: 4,
  },
  openBadge: {
    backgroundColor: tokens.status.success,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  openText: {
    fontSize: 10,
    fontWeight: '600',
    color: tokens.text.onBrand,
  },
  closedBadge: {
    backgroundColor: tokens.status.error,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  closedText: {
    fontSize: 10,
    fontWeight: '600',
    color: tokens.text.onBrand,
  },
  address: {
    fontSize: 13,
    color: tokens.text.muted,
    marginBottom: 8,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  type: {
    fontSize: 11,
    color: tokens.brand.default,
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
    color: tokens.text.primary,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: tokens.text.muted,
    marginTop: 8,
    textAlign: 'center',
  },
});

export default MerchantBrowseScreen;
