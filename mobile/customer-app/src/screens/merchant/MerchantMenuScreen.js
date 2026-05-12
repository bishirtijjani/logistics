/**
 * MerchantMenuScreen — browse a merchant's catalogue and build a cart of
 * fully-configured line items.
 *
 * Every product opens ProductDetailScreen for variant + option-group selection
 * (even single-SKU products with no options pass through it for consistency).
 * Lines come back via `route.params.cartReturn` and are merged into local state.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, ActivityIndicator, ScrollView, StyleSheet,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import api from '../../services/api';
import socketService from '../../services/socket';
import { colors } from '../../theme';
import { substitutionLabel } from '../../lib/requestStatus';

const money = (n) => `₦${Number(n || 0).toLocaleString()}`;

export default function MerchantMenuScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { t } = useTranslation();
  const { merchantId, categorySlug, cartReturn } = route.params || {};

  const [merchant, setMerchant] = useState(null);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);

  // Merge cart returned from ProductDetailScreen.
  useEffect(() => {
    if (cartReturn) {
      setCart(cartReturn);
      navigation.setParams({ cartReturn: undefined });
    }
  }, [cartReturn, navigation]);

  const fetchMenu = useCallback(async () => {
    try {
      const response = await api.get(`/merchants/${merchantId}`);
      const data = response?.data || {};
      setMerchant(data);
      setProducts(data.products || []);
    } catch (error) {
      Toast.show({ type: 'error', text1: t('errors.title'), text2: error.message });
    } finally {
      setLoading(false);
    }
  }, [merchantId]);

  useEffect(() => {
    let alive = true;
    fetchMenu();
    // 86 propagation: backend emits `merchant:menu:updated` to the merchant room
    // whenever a product / variant / option group / option item is mutated.
    // We re-fetch the catalogue on receipt so the customer sees the change in
    // socket-roundtrip time without polling.
    socketService.joinMerchantRoom(merchantId);
    const unsub = socketService.onMerchantMenuUpdated((data) => {
      if (alive && data?.merchantId === merchantId) fetchMenu();
    });
    return () => {
      alive = false;
      unsub?.();
      socketService.leaveMerchantRoom(merchantId);
    };
  }, [merchantId, fetchMenu]);

  const lowestPrice = (p) => {
    const prices = (p.variants || []).filter((v) => v.isAvailable).map((v) => Number(v.price));
    return prices.length ? Math.min(...prices) : Number(p.basePrice || 0);
  };

  // Source of truth for type-specific UX is the merchant's category slug
  // (admin-managed taxonomy). Falls back to the route-supplied slug so a deep
  // link without a fetched merchant still passes something through.
  const merchantCategorySlug = merchant?.category?.slug || categorySlug || null;
  const isGrocery = typeof merchantCategorySlug === 'string' && merchantCategorySlug.startsWith('grocery');

  const openProduct = (product) => {
    navigation.navigate('ProductDetail', { product, merchantId, merchantCategorySlug, cart });
  };

  const editLine = (lineId) => {
    const line = cart.find((l) => l.lineId === lineId);
    if (!line) return;
    const product = products.find((p) => p.id === line.productId);
    if (!product) return;
    navigation.navigate('ProductDetail', { product, merchantId, merchantCategorySlug, cart, editingLineId: lineId });
  };

  const removeLine = (lineId) => setCart(cart.filter((l) => l.lineId !== lineId));

  const cartTotal = useMemo(() => cart.reduce((s, l) => s + Number(l.lineTotal || 0), 0), [cart]);

  const goCheckout = () => {
    if (cart.length === 0) return;
    navigation.navigate('Checkout', {
      cart,
      merchantId,
      categorySlug,
      pickupLat: merchant?.lat || 0,
      pickupLng: merchant?.lng || 0,
      pickupAddress: merchant?.address || 'Merchant Location',
      pickupName: merchant?.name,
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView>
        {merchant?.coverImageUrl && <Image source={{ uri: merchant.coverImageUrl }} style={styles.cover} />}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.merchantName}>{merchant?.name}</Text>
            <Text style={styles.meta}>
              <Ionicons name="star" size={12} color="#FFA500" /> {merchant?.averageRating?.toFixed?.(1) || '—'} · {merchant?.address}
            </Text>
          </View>
        </View>

        {/* Cart preview */}
        {cart.length > 0 && (
          <View style={styles.cartPanel}>
            <Text accessibilityRole="header" style={styles.cartHeader}>{t('merchant.yourOrder')}</Text>
            {cart.map((line) => (
              <View key={line.lineId} style={styles.cartLine}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cartItemName}>
                    {line.quantity}× {line.name}
                    {line.variantSummary ? ` · ${line.variantSummary}` : ''}
                  </Text>
                  {(line.selectedOptions || []).map((g) => (
                    <Text key={g.groupId} style={styles.cartOpt}>
                      {g.groupName}: {g.items.map((i) => i.itemName).join(', ')}
                    </Text>
                  ))}
                  {line.specialInstructions ? (
                    <Text style={styles.cartInstructions}>“{line.specialInstructions}”</Text>
                  ) : null}
                  {/* Phase 8 — per-line markers. Substitution chip is grocery-only;
                      Rx pill flags pharmacy items that need a prescription upload. */}
                  <View style={styles.chipsRow}>
                    {isGrocery && line.substitution ? (
                      <View style={styles.subChip}>
                        <Ionicons name="swap-horizontal" size={11} color="#7C3AED" />
                        <Text style={styles.subChipText}>{substitutionLabel(line.substitution, t)}</Text>
                      </View>
                    ) : null}
                    {line.requiresPrescription ? (
                      <View style={styles.rxChip}>
                        <Ionicons name="medkit-outline" size={11} color="#B45309" />
                        <Text style={styles.rxChipText}>{t('merchant.rx')}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.linePrice}>{money(line.lineTotal)}</Text>
                  <View style={{ flexDirection: 'row', marginTop: 4 }}>
                    <TouchableOpacity
                      onPress={() => editLine(line.lineId)}
                      style={styles.lineBtn}
                      accessibilityRole="button"
                      accessibilityLabel={t('a11y.editItem')}
                    >
                      <Ionicons name="pencil" size={14} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => removeLine(line.lineId)}
                      style={styles.lineBtn}
                      accessibilityRole="button"
                      accessibilityLabel={t('a11y.removeItem')}
                    >
                      <Ionicons name="trash" size={14} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.menuContainer}>
          <Text accessibilityRole="header" style={styles.menuTitle}>{t('merchant.menuTitle')}</Text>
          {products.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="restaurant-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>{t('merchant.menuUnavailable')}</Text>
            </View>
          ) : (
            products.filter((p) => p.isAvailable).map((p) => (
              <TouchableOpacity
                key={p.id}
                onPress={() => openProduct(p)}
                style={styles.productCard}
                accessibilityRole="button"
                accessibilityLabel={p.name}
                accessibilityHint={p.description || ''}
              >
                <Image source={{ uri: p.imageUrl || 'https://via.placeholder.com/100' }} style={styles.productImage} />
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{p.name}</Text>
                  {p.description ? (
                    <Text style={styles.productDesc} numberOfLines={2}>{p.description}</Text>
                  ) : null}
                  <Text style={styles.productPrice}>
                    {(p.variants || []).length > 1 ? `${t('merchant.fromPrice').toLowerCase()} ` : ''}{money(lowestPrice(p))}
                  </Text>
                  {(p.optionGroups || []).length > 0 && (
                    <Text style={styles.tag}>{t('merchant.customizable')}</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {cart.length > 0 && (
        <View style={styles.footer}>
          <View>
            <Text style={styles.fCount}>{t('merchant.itemCount', { count: cart.length })}</Text>
            <Text style={styles.fTotal}>{money(cartTotal)}</Text>
          </View>
          <TouchableOpacity
            style={styles.checkoutBtn}
            onPress={goCheckout}
            accessibilityRole="button"
            accessibilityLabel={t('merchant.reviewCheckout')}
          >
            <Text style={styles.checkoutText}>{t('merchant.reviewCheckout')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cover: { width: '100%', height: 140 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  merchantName: { fontSize: 18, fontWeight: '600', color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  cartPanel: { backgroundColor: colors.surface, padding: 12, marginTop: 8 },
  cartHeader: { fontWeight: '600', fontSize: 14, color: colors.text, marginBottom: 8 },
  cartLine: { flexDirection: 'row', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  cartItemName: { fontSize: 14, color: colors.text, fontWeight: '500' },
  cartOpt: { fontSize: 12, color: colors.textMuted },
  cartInstructions: { fontSize: 12, fontStyle: 'italic', color: colors.textMuted },
  linePrice: { fontSize: 14, color: colors.text, fontWeight: '600' },
  lineBtn: { padding: 6 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  subChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3E8FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginRight: 6, marginTop: 2 },
  subChipText: { color: '#7C3AED', fontSize: 11, fontWeight: '700', marginLeft: 4 },
  rxChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginRight: 6, marginTop: 2 },
  rxChipText: { color: '#B45309', fontSize: 11, fontWeight: '700', marginLeft: 4 },

  menuContainer: { padding: 16 },
  menuTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 12 },
  productCard: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: colors.surface, borderRadius: 12, marginBottom: 10 },
  productImage: { width: 64, height: 64, borderRadius: 8, marginRight: 12 },
  productInfo: { flex: 1 },
  productName: { fontSize: 15, fontWeight: '600', color: colors.text },
  productDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  productPrice: { fontSize: 14, fontWeight: '600', color: colors.primary, marginTop: 4 },
  tag: { marginTop: 4, fontSize: 11, color: colors.primary },

  empty: { alignItems: 'center', paddingVertical: 36 },
  emptyTitle: { marginTop: 8, fontSize: 14, color: colors.textMuted },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.surface, padding: 14, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fCount: { fontSize: 12, color: colors.textMuted },
  fTotal: { fontSize: 18, fontWeight: '700', color: colors.text },
  checkoutBtn: { backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10 },
  checkoutText: { color: '#fff', fontWeight: '600' },
});
