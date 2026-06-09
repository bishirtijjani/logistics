/**
 * MerchantMenuScreen - browse a merchant's catalogue and build a cart.
 *
 * Cart is single-merchant and lives in Redux (`cartSlice`). This screen:
 *   - Reads the cart from the store, but only renders the inline preview when
 *     the cart actually belongs to *this* merchant (otherwise the preview
 *     would show another merchant's items).
 *   - Lets the customer edit/remove cart lines that belong here.
 *   - Dispatches `removeLine` directly; adds happen in ProductDetailScreen.
 *   - "View cart" CTA navigates to `Cart` (the dedicated review screen) -
 *     which in turn opens Checkout. Single source of truth for the cart UI.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, ActivityIndicator, ScrollView, StyleSheet,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import api from '../../services/api';
import socketService from '../../services/socket';
import { colors } from '../../theme';
import { substitutionLabel } from '../../lib/requestStatus';
import { computeCartTotal } from '../../lib/cart';
import { removeLine, selectCart } from '../../store/slices/cartSlice';

const money = (n) => `₦${Number(n || 0).toLocaleString()}`;

export default function MerchantMenuScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { merchantId, categorySlug, highlightProductId } = route.params || {};

  const cart = useSelector(selectCart);
  // Only show the inline cart preview when the cart actually belongs to this
  // merchant - otherwise we'd be showing another merchant's items in the
  // wrong context.
  const linesHere = useMemo(
    () => (cart.merchantId === merchantId ? cart.lines : []),
    [cart.merchantId, cart.lines, merchantId],
  );

  const [merchant, setMerchant] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

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
  }, [merchantId, t]);

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
    navigation.navigate('ProductDetail', {
      product,
      merchantId,
      merchant,
      merchantCategorySlug,
    });
  };

  const editLine = (lineId) => {
    const line = linesHere.find((l) => l.lineId === lineId);
    if (!line) return;
    const product = products.find((p) => p.id === line.productId);
    if (!product) return;
    navigation.navigate('ProductDetail', {
      product,
      merchantId,
      merchant,
      merchantCategorySlug,
      editingLineId: lineId,
    });
  };

  const onRemoveLine = (lineId) => dispatch(removeLine(lineId));

  const cartTotal = useMemo(() => computeCartTotal(linesHere), [linesHere]);

  const goViewCart = () =>
    navigation.navigate('MainTabs', { screen: 'CartTab' });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: linesHere.length > 0 ? 110 : 24 }}>
        {merchant?.coverImageUrl && <Image source={{ uri: merchant.coverImageUrl }} style={styles.cover} />}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.merchantName}>{merchant?.name}</Text>
            <Text style={styles.meta}>
              <Ionicons name="star" size={12} color="#FFA500" /> {merchant?.averageRating?.toFixed?.(1) || '-'} · {merchant?.address}
            </Text>
          </View>
        </View>

        {/* Cart preview - only when the cart belongs to this merchant. */}
        {linesHere.length > 0 && (
          <View style={styles.cartPanel}>
            <Text accessibilityRole="header" style={styles.cartHeader}>{t('merchant.yourOrder')}</Text>
            {linesHere.map((line) => (
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
                  {/* Phase 8 - per-line markers. Substitution chip is grocery-only;
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
                      onPress={() => onRemoveLine(line.lineId)}
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
                style={[styles.productCard, p.id === highlightProductId && styles.productCardHighlight]}
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

      {linesHere.length > 0 && (
        <View style={styles.footer}>
          <View>
            <Text style={styles.fCount}>{t('merchant.itemCount', { count: linesHere.length })}</Text>
            <Text style={styles.fTotal}>{money(cartTotal)}</Text>
          </View>
          <TouchableOpacity
            style={styles.checkoutBtn}
            onPress={goViewCart}
            accessibilityRole="button"
            accessibilityLabel={t('cart.viewCart')}
          >
            <Ionicons name="bag-handle" size={16} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.checkoutText}>{t('cart.viewCart')}</Text>
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
  productCardHighlight: { borderWidth: 1.5, borderColor: colors.primary },
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
  checkoutBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10 },
  checkoutText: { color: '#fff', fontWeight: '700' },
});
