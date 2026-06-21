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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import api from '../../services/api';
import socketService from '../../services/socket';
import { useTheme } from '../../theme';
import SkeletonLoader from '../../components/SkeletonLoader';
import EmptyState from '../../components/EmptyState';
import SearchModal from '../../components/SearchModal';

const initialFor = (name = '') =>
  (name || '?').trim().charAt(0).toUpperCase() || '?';

// Cover banner. Shows the merchant's uploaded cover when present; otherwise our
// own branded default (a brand-gradient panel with a storefront glyph + the
// shop name) so the banner is never an empty box. `onBrand` text/icon keeps
// contrast correct in both light and dark mode. Onboarding now requires a
// cover, so this default is only seen for merchants who registered earlier.
const CoverBanner = ({ item, styles, tokens }) => {
  const [coverFailed, setCoverFailed] = useState(false);

  if (item.coverImageUrl && !coverFailed) {
    return (
      <Image
        source={{ uri: item.coverImageUrl }}
        style={styles.cover}
        onError={() => setCoverFailed(true)}
      />
    );
  }

  return (
    <LinearGradient
      colors={[tokens.brand.default, tokens.brand.strong]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.cover, styles.coverDefault]}
    >
      <Ionicons name="storefront" size={34} color={tokens.text.onBrand} style={{ opacity: 0.92 }} />
      <Text style={styles.coverDefaultText} numberOfLines={1}>{item.name}</Text>
    </LinearGradient>
  );
};

// One merchant as a rich card: full-width cover banner (real photo or branded
// default) with the open/closed badge floated on it, then a row with the logo
// (or generated initial), name, rating, and address. The logo Image falls back
// to the initial on error so a broken/missing URL never leaves an empty box.
const MerchantRow = ({ item, styles, tokens, t, onPress }) => {
  const [logoFailed, setLogoFailed] = useState(false);
  const showLogo = !!item.logoUrl && !logoFailed;
  const initial = initialFor(item.name);

  return (
    <TouchableOpacity
      style={[styles.merchantCard, !item.isOpen && styles.merchantCardClosed]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}. ${item.isOpen ? t('merchant.openNow') : t('merchant.closed')}`}
      accessibilityHint={item.address}
    >
      <View>
        <CoverBanner item={item} styles={styles} tokens={tokens} />
        <View style={[styles.coverBadge, item.isOpen ? styles.openBadge : styles.closedBadge]}>
          <Text style={item.isOpen ? styles.openText : styles.closedText}>
            {item.isOpen ? t('merchant.openNow') : t('merchant.closed')}
          </Text>
        </View>
      </View>

      <View style={styles.infoRow}>
        {showLogo ? (
          <Image
            source={{ uri: item.logoUrl }}
            style={styles.logo}
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <View style={[styles.logo, styles.logoFallback]}>
            <Text style={styles.logoInitial}>{initial}</Text>
          </View>
        )}

        <View style={styles.merchantInfo}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={13} color="#FFA500" />
            <Text style={styles.rating}>{item.averageRating.toFixed(1)}</Text>
            <Text style={styles.orderCount}>
              {t('merchant.ordersCount', { count: item.totalOrders })}
            </Text>
            {!!item.category?.name && (
              <>
                <Text style={styles.dot}>·</Text>
                <Text style={styles.type} numberOfLines={1}>{item.category.name}</Text>
              </>
            )}
          </View>
          <Text style={styles.address} numberOfLines={1}>{item.address}</Text>
        </View>

        <Ionicons name="chevron-forward" size={18} color={tokens.text.muted} />
      </View>
    </TouchableOpacity>
  );
};

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

  // Live open/closed status: merchant self-toggle or admin override both
  // emit `merchant:status:changed` to every connected client, so patch the
  // matching card in place instead of waiting for the next manual refresh.
  useEffect(() => {
    const unsub = socketService.onMerchantStatusChanged((data) => {
      if (!data?.merchantId) return;
      setMerchants((prev) => {
        if (!prev.some((m) => m.id === data.merchantId)) return prev;
        const updated = prev.map((m) =>
          m.id === data.merchantId ? { ...m, isOpen: data.effectiveOpen } : m
        );
        return [...updated].sort((a, b) => Number(b.isOpen) - Number(a.isOpen));
      });
    });
    return () => unsub?.();
  }, []);

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
    <MerchantRow
      item={item}
      styles={styles}
      tokens={tokens}
      t={t}
      onPress={() =>
        navigation.navigate('MerchantMenu', { merchantId: item.id, categorySlug })
      }
    />
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
  // Rich card: full-width cover banner on top, info row (logo + text + chevron)
  // below.
  merchantCard: {
    backgroundColor: tokens.bg.surface,
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: tokens.border.subtle,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  // Closed merchants stay visible but dimmed so they read as inactive while the
  // open ones (sorted first) remain the primary choice.
  merchantCardClosed: {
    opacity: 0.55,
  },
  cover: {
    width: '100%',
    height: 140,
    resizeMode: 'cover',
    backgroundColor: tokens.bg.surfaceMuted,
  },
  // Our own default cover: centered storefront glyph + shop name on a brand
  // gradient (the gradient colors are applied inline by LinearGradient).
  coverDefault: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverDefaultText: {
    marginTop: 6,
    paddingHorizontal: 16,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: tokens.text.onBrand,
  },
  // Open/closed pill floated on the top-right of the cover.
  coverBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: tokens.bg.surfaceMuted,
  },
  logoFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.brand.soft,
  },
  logoInitial: {
    fontSize: 20,
    fontWeight: '700',
    color: tokens.brand.default,
  },
  merchantInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.text.primary,
    letterSpacing: -0.2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  rating: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.text.primary,
    marginLeft: 3,
  },
  orderCount: {
    fontSize: 12,
    color: tokens.text.muted,
    marginLeft: 4,
  },
  dot: {
    fontSize: 12,
    color: tokens.text.muted,
    marginHorizontal: 6,
  },
  openBadge: {
    backgroundColor: tokens.status.successSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  openText: {
    fontSize: 10,
    fontWeight: '700',
    color: tokens.status.successStrong,
  },
  closedBadge: {
    backgroundColor: tokens.status.errorSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  closedText: {
    fontSize: 10,
    fontWeight: '700',
    color: tokens.status.errorStrong,
  },
  address: {
    fontSize: 13,
    color: tokens.text.muted,
    marginTop: 3,
  },
  type: {
    flexShrink: 1,
    fontSize: 12,
    color: tokens.brand.strong,
    fontWeight: '600',
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
