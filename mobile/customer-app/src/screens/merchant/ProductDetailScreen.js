/**
 * ProductDetailScreen - Phase 2 food/retail item customization.
 *
 * Renders, in order:
 *   1. Hero image + name + base price
 *   2. Variant picker (size chips) when product has > 1 variant
 *   3. Each option group with appropriate input style:
 *        REQUIRED_ONE / OPTIONAL_ONE       → radio list
 *        REQUIRED_MULTIPLE / OPTIONAL_MULTIPLE → checkbox list (disabled at max)
 *   4. Special instructions textarea (max 200 chars)
 *   5. Quantity stepper
 *   6. Sticky "Add to cart · ₦{liveTotal}" CTA
 *
 * The CTA is disabled until every REQUIRED_* group is satisfied; tapping a
 * disabled CTA scrolls the first offending group into view.
 *
 * On submit we hand a fully-configured cart-line back to MerchantMenuScreen
 * via route params. Server validates and recomputes prices at order time.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { goBackOr } from "../../lib/goBack";
import {
  View, Text, ScrollView, Image, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { buildMerchantSnapshot } from '../../lib/cart';
import {
  addLine,
  clearCart,
  selectCart,
  updateLine,
} from '../../store/slices/cartSlice';

const money = (n) => `₦${Number(n || 0).toLocaleString()}`;

// Phase 8 - substitution is grocery-only UX. Detection by slug prefix keeps
// admin's category taxonomy in charge (any new "grocery-*" category Just Works).
const isGrocerySlug = (slug) => typeof slug === 'string' && slug.startsWith('grocery');

// Resolved at render time from i18n; the wire value is the enum on `value`.
const SUBSTITUTION_OPTIONS = [
  { value: 'MERCHANT_PICK', labelKey: 'merchant.subPick',    subKey: 'merchant.subPickHint' },
  { value: 'CONTACT_ME',    labelKey: 'merchant.subContact', subKey: 'merchant.subContactHint' },
  { value: 'NONE',          labelKey: 'merchant.subNone',    subKey: 'merchant.subNoneHint' },
];

export default function ProductDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { tokens } = useTheme();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);
  const cart = useSelector(selectCart);
  const { product, merchantId, merchant, merchantCategorySlug, editingLineId } = route.params || {};

  const variants = useMemo(() => product?.variants || [], [product]);
  const optionGroups = useMemo(() => product?.optionGroups || [], [product]);
  const showSubstitution = isGrocerySlug(merchantCategorySlug);

  // Pre-fill from editing line if one was passed (works because the line is
  // already in Redux when MerchantMenuScreen navigates here with editingLineId).
  const editingLine = editingLineId
    ? cart.lines.find((l) => l.lineId === editingLineId)
    : null;

  const [variantId, setVariantId] = useState(
    editingLine?.variantId || (variants.length === 1 ? variants[0].id : variants.find((v) => v.isAvailable && v.stock > 0)?.id) || ''
  );
  // Default to MERCHANT_PICK on first-add. Grocery shoppers nearly always want
  // a sensible swap when an item is out - making them tap NONE explicitly
  // matches Instacart/Jumia behavior and avoids surprise refunds.
  const [substitution, setSubstitution] = useState(
    editingLine?.substitution || (showSubstitution ? 'MERCHANT_PICK' : null)
  );
  // selected[groupId] = Set of itemIds
  const [selected, setSelected] = useState(() => {
    const init = {};
    optionGroups.forEach((g) => {
      const existing = editingLine?.selectedOptions?.find((s) => s.groupId === g.id);
      if (existing) {
        init[g.id] = new Set(existing.items.map((it) => it.itemId));
      } else {
        // Auto-select isDefault items, respecting maxSelect.
        const defaults = g.items.filter((it) => it.isDefault && it.isAvailable).slice(0, g.maxSelect);
        init[g.id] = new Set(defaults.map((it) => it.id));
      }
    });
    return init;
  });
  const [quantity, setQuantity] = useState(editingLine?.quantity || 1);
  const [instructions, setInstructions] = useState(editingLine?.specialInstructions || '');
  const [highlightGroupId, setHighlightGroupId] = useState(null);
  const groupRefs = useRef({});
  const scrollRef = useRef(null);

  const variant = variants.find((v) => v.id === variantId);
  // A variant is orderable only when it's switched on AND has stock. The
  // backend rejects out-of-stock orders (request.service.js), so we block
  // selection here rather than let the customer hit that error at checkout.
  const selectedSellable = variants.length === 0 || (!!variant && variant.isAvailable && variant.stock > 0);
  const maxQty = variant && variant.stock > 0 ? Math.min(99, variant.stock) : 99;

  // Clamp quantity when the picked variant changes to one with less stock.
  useEffect(() => {
    setQuantity((q) => Math.min(q, maxQty));
  }, [maxQty]);

  const optionDelta = useMemo(() => {
    let sum = 0;
    for (const group of optionGroups) {
      const picked = selected[group.id] || new Set();
      for (const itemId of picked) {
        const item = group.items.find((i) => i.id === itemId);
        if (item) sum += Number(item.priceDelta || 0);
      }
    }
    return sum;
  }, [optionGroups, selected]);

  const unitPrice = (variant ? Number(variant.price) : Number(product?.basePrice || 0)) + optionDelta;
  const lineTotal = unitPrice * quantity;

  const validate = () => {
    for (const group of optionGroups) {
      const picked = selected[group.id] || new Set();
      const isRequired = group.selectionRule === 'REQUIRED_ONE' || group.selectionRule === 'REQUIRED_MULTIPLE';
      if (isRequired && picked.size < (group.minSelect || 1)) {
        return group.id;
      }
      if (picked.size > group.maxSelect) {
        return group.id;
      }
    }
    return null;
  };

  const togglePick = (group, itemId) => {
    setSelected((prev) => {
      const next = { ...prev };
      const set = new Set(next[group.id] || new Set());
      const oneRule = group.selectionRule === 'REQUIRED_ONE' || group.selectionRule === 'OPTIONAL_ONE';
      if (oneRule) {
        if (set.has(itemId)) {
          if (group.selectionRule === 'OPTIONAL_ONE') set.delete(itemId);
        } else {
          set.clear();
          set.add(itemId);
        }
      } else {
        if (set.has(itemId)) set.delete(itemId);
        else if (set.size < group.maxSelect) set.add(itemId);
      }
      next[group.id] = set;
      return next;
    });
  };

  const onAdd = () => {
    if (!selectedSellable) return;
    const offendingGroupId = validate();
    if (offendingGroupId) {
      setHighlightGroupId(offendingGroupId);
      const node = groupRefs.current[offendingGroupId];
      if (node && scrollRef.current) {
        node.measureLayout(scrollRef.current.getInnerViewNode?.() || scrollRef.current, (x, y) => {
          scrollRef.current?.scrollTo({ y: Math.max(0, y - 80), animated: true });
        }, () => {});
      }
      return;
    }

    // Build the snapshot the server expects.
    const selectedOptionsPayload = optionGroups
      .map((group) => {
        const ids = Array.from(selected[group.id] || []);
        if (ids.length === 0) return null;
        return {
          groupId: group.id,
          groupName: group.name,
          itemIds: ids,
          items: ids.map((id) => {
            const item = group.items.find((it) => it.id === id);
            return { itemId: id, itemName: item?.name, priceDelta: Number(item?.priceDelta || 0) };
          }),
        };
      })
      .filter(Boolean);

    const line = {
      lineId: editingLineId || `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      productId: product.id,
      variantId: variant?.id,
      name: product.name,
      variantSummary: variant
        ? Object.values(variant.attributes || {}).join(' / ') || variant.packLabel || ''
        : '',
      imageUrl: variant?.imageUrl || product.imageUrl,
      quantity,
      unitPrice,
      lineTotal,
      selectedOptions: selectedOptionsPayload,
      specialInstructions: instructions.trim() || null,
      // Phase 8 - flags carried on the line so downstream screens (menu, cart,
      // checkout) don't have to re-derive them from the product object.
      substitution: showSubstitution ? substitution : null,
      requiresPrescription: Boolean(product.requiresPrescription),
      dosage: product.dosage || null,
    };

    // Editing an existing line never changes the merchant, so we always
    // dispatch updateLine straight through.
    if (editingLineId) {
      dispatch(updateLine(line));
      goBackOr(navigation);
      return;
    }

    const snapshot = buildMerchantSnapshot(merchant, merchantCategorySlug);
    const currentMerchantId = cart.merchantId;
    const hasItemsFromAnotherMerchant =
      currentMerchantId && currentMerchantId !== merchantId;

    if (hasItemsFromAnotherMerchant) {
      // Single-merchant cart rule. Prompt before wiping the existing cart so
      // the user doesn't lose work they were actively building.
      Alert.alert(
        t('cart.startNewTitle'),
        t('cart.startNewBody', {
          prev: cart.merchant?.name || t('cart.previousMerchantFallback'),
          next: snapshot?.name || product.name,
        }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('cart.startNewCta'),
            style: 'destructive',
            onPress: () => {
              dispatch(clearCart());
              dispatch(addLine(line, snapshot));
              goBackOr(navigation);
            },
          },
        ],
      );
      return;
    }

    dispatch(addLine(line, snapshot));
    goBackOr(navigation);
  };

  if (!product) {
    return (
      <View style={styles.center}>
        <Text>{t('errors.NOT_FOUND')}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <View style={styles.container}>
        <ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: 140 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
          {/* Hero */}
          {product.imageUrl && (
            <Image source={{ uri: product.imageUrl }} style={styles.hero} />
          )}
          <View style={{ padding: 16 }}>
            <View style={styles.headerRow}>
              <TouchableOpacity
                onPress={() => goBackOr(navigation)}
                style={styles.backBtn}
                accessibilityRole="button"
                accessibilityLabel={t('a11y.back')}
              >
                <Ionicons name="arrow-back" size={20} color={tokens.text.primary} />
              </TouchableOpacity>
            </View>
            <Text accessibilityRole="header" style={styles.title}>{product.name}</Text>
            {product.description ? <Text style={styles.desc}>{product.description}</Text> : null}
            <Text style={styles.basePrice}>{t('merchant.fromPrice')} {money(variant?.price ?? product.basePrice)}</Text>
            {product.requiresPrescription && (
              <View style={styles.rxBanner}>
                <Ionicons name="medkit-outline" size={16} color={tokens.status.warningStrong} />
                <Text style={styles.rxText}>{t('merchant.rxRequired')}</Text>
              </View>
            )}
          </View>

          {/* Variant picker */}
          {variants.length > 1 && (
            <View style={styles.section}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>{t('merchant.chooseOption')}</Text>
              <View style={styles.chipsRow}>
                {variants.map((v) => {
                  const label = Object.values(v.attributes || {}).join(' / ') || v.packLabel || v.sku || t('common.search');
                  const selectedThis = v.id === variantId;
                  const outOfStock = v.isAvailable && v.stock <= 0;
                  const sellable = v.isAvailable && v.stock > 0;
                  return (
                    <TouchableOpacity
                      key={v.id}
                      disabled={!sellable}
                      onPress={() => setVariantId(v.id)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: selectedThis, disabled: !sellable }}
                      accessibilityLabel={`${label} ${money(v.price)}`}
                      style={[styles.chip, selectedThis && styles.chipActive, !sellable && styles.chipDisabled]}
                    >
                      <Text style={[styles.chipText, selectedThis && styles.chipTextActive]}>
                        {label} · {money(v.price)}
                      </Text>
                      {!v.isAvailable && <Text style={styles.unavail}>{t('merchant.unavailable')}</Text>}
                      {outOfStock && <Text style={styles.unavail}>{t('merchant.outOfStock')}</Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Option groups */}
          {optionGroups.map((group) => {
            const picked = selected[group.id] || new Set();
            const isOne = group.selectionRule === 'REQUIRED_ONE' || group.selectionRule === 'OPTIONAL_ONE';
            const isRequired = group.selectionRule === 'REQUIRED_ONE' || group.selectionRule === 'REQUIRED_MULTIPLE';
            const ruleText = isOne
              ? isRequired ? t('merchant.chooseOne') : t('merchant.optionalOne')
              : isRequired
                ? t('merchant.pickRange', { min: group.minSelect, max: group.maxSelect })
                : t('merchant.optionalUpTo', { max: group.maxSelect });
            const highlight = highlightGroupId === group.id;
            return (
              <View
                key={group.id}
                ref={(r) => { groupRefs.current[group.id] = r; }}
                style={[styles.section, highlight && styles.sectionHighlight]}
              >
                <View style={styles.groupHeader}>
                  <Text accessibilityRole="header" style={styles.sectionTitle}>{group.name}</Text>
                  <Text style={styles.groupRule}>{ruleText}</Text>
                </View>
                {group.items.map((item) => {
                  const isPicked = picked.has(item.id);
                  const reachedMax = !isPicked && picked.size >= group.maxSelect && !isOne;
                  const disabled = !item.isAvailable || reachedMax;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => !disabled && togglePick(group, item.id)}
                      style={[styles.itemRow, disabled && styles.itemRowDisabled]}
                      disabled={disabled}
                      accessibilityRole={isOne ? 'radio' : 'checkbox'}
                      accessibilityState={{ checked: isPicked, selected: isPicked, disabled }}
                      accessibilityLabel={item.name}
                    >
                      <View style={[styles.indicator, isOne ? styles.radio : styles.checkbox]}>
                        {isPicked && (isOne ? <View style={styles.radioDot} /> : <Ionicons name="checkmark" size={14} color={tokens.text.onBrand} />)}
                      </View>
                      <Text style={[styles.itemName, !item.isAvailable && styles.lineThrough]}>
                        {item.name}
                      </Text>
                      {Number(item.priceDelta) !== 0 && (
                        <Text style={styles.delta}>+{money(item.priceDelta)}</Text>
                      )}
                      {!item.isAvailable && <Text style={styles.tag}>{t('merchant.unavailableToday')}</Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })}

          {/* Special instructions */}
          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>{t('merchant.specialInstructions')}</Text>
            <TextInput
              value={instructions}
              onChangeText={(text) => text.length <= 200 && setInstructions(text)}
              placeholder={t('merchant.specialInstructionsPh')}
              accessibilityLabel={t('merchant.specialInstructions')}
              multiline
              style={styles.textArea}
            />
            <Text style={styles.charCount}>{instructions.length}/200</Text>
          </View>

          {/* Phase 8 - grocery substitution preference. Hidden for non-grocery
              merchants so non-grocery shoppers never see an irrelevant control. */}
          {showSubstitution && (
            <View style={styles.section}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>{t('merchant.substitutionTitle')}</Text>
              <Text style={styles.groupRule}>{t('merchant.substitutionSubtitle')}</Text>
              <View style={{ marginTop: 8 }} accessibilityRole="radiogroup">
                {SUBSTITUTION_OPTIONS.map((opt) => {
                  const picked = substitution === opt.value;
                  const optLabel = t(opt.labelKey);
                  const optSub = t(opt.subKey);
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => setSubstitution(opt.value)}
                      style={styles.subRow}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: picked }}
                      accessibilityLabel={optLabel}
                      accessibilityHint={optSub}
                    >
                      <View style={[styles.indicator, styles.radio]}>
                        {picked && <View style={styles.radioDot} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.subLabel}>{optLabel}</Text>
                        <Text style={styles.subSub}>{optSub}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Quantity */}
          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>{t('merchant.quantity')}</Text>
            <View style={styles.qtyRow}>
              <TouchableOpacity
                onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                style={styles.qtyBtn}
                accessibilityRole="button"
                accessibilityLabel={`${t('merchant.quantity')} -`}
              >
                <Ionicons name="remove" size={20} color={tokens.text.primary} />
              </TouchableOpacity>
              <Text style={styles.qtyValue} accessibilityLiveRegion="polite">{quantity}</Text>
              <TouchableOpacity
                onPress={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                style={styles.qtyBtn}
                accessibilityRole="button"
                accessibilityLabel={`${t('merchant.quantity')} +`}
              >
                <Ionicons name="add" size={20} color={tokens.text.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {/* Sticky CTA */}
        <View style={styles.cta}>
          <TouchableOpacity
            onPress={onAdd}
            disabled={!selectedSellable}
            style={[styles.ctaBtn, !selectedSellable && styles.ctaBtnDisabled]}
            accessibilityRole="button"
            accessibilityState={{ disabled: !selectedSellable }}
            accessibilityLabel={editingLineId ? t('merchant.updateItem') : t('merchant.addToCart')}
          >
            <Text style={styles.ctaText}>
              {!selectedSellable
                ? t('merchant.outOfStock')
                : `${editingLineId ? t('merchant.updateItem') : t('merchant.addToCart')} · ${money(lineTotal)}`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (tokens) => StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.bg.canvas },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { width: '100%', height: 220, resizeMode: 'cover' },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  backBtn: { padding: 4 },
  title: { fontSize: 22, fontWeight: '700', color: tokens.text.primary },
  desc: { fontSize: 14, color: tokens.text.muted, marginTop: 4 },
  basePrice: { fontSize: 18, fontWeight: '600', color: tokens.brand.default, marginTop: 8 },
  rxBanner: { flexDirection: 'row', alignItems: 'center', marginTop: 10, padding: 8, backgroundColor: tokens.status.warningSoft, borderRadius: 8 },
  rxText: { marginLeft: 6, color: tokens.status.warningStrong, fontSize: 13, fontWeight: '600' },

  section: { padding: 16, borderTopWidth: 8, borderTopColor: tokens.bg.canvas, backgroundColor: tokens.bg.surface },
  sectionHighlight: { backgroundColor: tokens.status.errorSoft },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: tokens.text.primary },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  groupRule: { fontSize: 12, color: tokens.text.muted },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: tokens.border.default, marginRight: 8, marginBottom: 8 },
  chipActive: { backgroundColor: tokens.brand.default, borderColor: tokens.brand.default },
  chipDisabled: { opacity: 0.4 },
  chipText: { color: tokens.text.primary, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: tokens.text.onBrand },
  unavail: { fontSize: 10, color: tokens.status.errorStrong },

  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: tokens.border.default },
  itemRowDisabled: { opacity: 0.45 },
  indicator: { width: 22, height: 22, marginRight: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: tokens.border.default },
  radio: { borderRadius: 11 },
  checkbox: { borderRadius: 5, backgroundColor: 'transparent' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: tokens.brand.default },
  itemName: { flex: 1, fontSize: 14, color: tokens.text.primary },
  lineThrough: { textDecorationLine: 'line-through', color: tokens.text.muted },
  delta: { fontSize: 13, color: tokens.text.muted, marginLeft: 8 },
  tag: { fontSize: 11, color: tokens.status.errorStrong, marginLeft: 8 },

  textArea: { marginTop: 8, padding: 10, minHeight: 70, borderWidth: 1, borderColor: tokens.border.default, borderRadius: 8, fontSize: 14, color: tokens.text.primary, textAlignVertical: 'top' },
  charCount: { textAlign: 'right', fontSize: 11, color: tokens.text.muted, marginTop: 4 },

  subRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: tokens.border.default },
  subLabel: { fontSize: 14, fontWeight: '600', color: tokens.text.primary },
  subSub: { fontSize: 12, color: tokens.text.muted, marginTop: 2 },

  qtyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  qtyBtn: { padding: 10, backgroundColor: tokens.bg.canvas, borderRadius: 8 },
  qtyValue: { paddingHorizontal: 18, fontSize: 16, fontWeight: '600', color: tokens.text.primary },

  cta: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: tokens.bg.surface, borderTopWidth: 1, borderTopColor: tokens.border.default },
  ctaBtn: { backgroundColor: tokens.brand.default, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  ctaBtnDisabled: { backgroundColor: tokens.text.muted, opacity: 0.6 },
  ctaText: { color: tokens.text.onBrand, fontSize: 16, fontWeight: '700' },
});
