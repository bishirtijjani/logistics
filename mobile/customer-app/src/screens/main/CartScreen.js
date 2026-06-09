/**
 * CartScreen - the dedicated review/edit view for the persisted cart.
 *
 * Reached from the bottom-tab `CartTab` and from the "View cart" CTA on
 * `MerchantMenuScreen`. Shows:
 *   - The merchant the cart belongs to (single-merchant rule).
 *   - Each line with the same chips/variants the menu's inline preview
 *     shows (substitution, Rx, quantity, options, instructions).
 *   - A subtotal footer with a "Proceed to checkout" CTA → CheckoutScreen.
 *   - An empty state with a "Browse shops" CTA when nothing's in the cart.
 *
 * Editing a line opens ProductDetail in edit mode (existing flow); removing
 * a line dispatches `removeLine` which auto-clears the merchant if it was
 * the last line.
 */

import React, { useCallback, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Image, StyleSheet, Alert, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";

import { useTheme } from "../../theme";
import EmptyState from "../../components/EmptyState";
import { substitutionLabel } from "../../lib/requestStatus";
import { computeCartTotal } from "../../lib/cart";
import { clearCart, hydrateCartFromStorage, removeLine, selectCart } from "../../store/slices/cartSlice";
import api from "../../services/api";

const money = (n) => `₦${Number(n || 0).toLocaleString()}`;

export default function CartScreen() {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);
  const cart = useSelector(selectCart);
  const [editingLineId, setEditingLineId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await dispatch(hydrateCartFromStorage());
    } finally {
      setRefreshing(false);
    }
  }, [dispatch]);

  const lines = cart.lines;
  const merchant = cart.merchant;
  const isGrocery =
    typeof merchant?.categorySlug === "string" && merchant.categorySlug.startsWith("grocery");
  const total = computeCartTotal(lines);

  const confirmClear = () => {
    Alert.alert(
      t("cart.clearTitle"),
      t("cart.clearBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("cart.clearCta"), style: "destructive", onPress: () => dispatch(clearCart()) },
      ],
    );
  };

  const goBrowse = () => {
    // CartTab is a top-level tab - go to Home tab so the customer can start
    // shopping. `popToTop` first so we don't pile screens forever.
    navigation.navigate("MainTabs", { screen: "HomeTab" });
  };

  const editLine = async (line) => {
    if (!merchant?.id || editingLineId) return;
    // Fetch the merchant (with products) directly so the user lands on
    // ProductDetail in one hop and goBack returns them straight to the
    // cart - not via the menu screen, which would feel like a detour.
    setEditingLineId(line.lineId);
    try {
      const r = await api.get(`/merchants/${merchant.id}`);
      const merchantData = r?.data;
      const product = (merchantData?.products || []).find((p) => p.id === line.productId);
      if (!product) {
        Toast.show({ type: "error", text1: t("merchant.unavailable") });
        return;
      }
      navigation.navigate("ProductDetail", {
        product,
        merchantId: merchant.id,
        merchant: merchantData,
        merchantCategorySlug: merchant.categorySlug,
        editingLineId: line.lineId,
      });
    } catch (err) {
      Toast.show({ type: "error", text1: t("errors.title"), text2: err?.message });
    } finally {
      setEditingLineId(null);
    }
  };

  const onRemove = (lineId) => dispatch(removeLine(lineId));

  const goCheckout = () => navigation.navigate("Checkout");

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={() => navigation.canGoBack() ? navigation.goBack() : goBrowse()}
        style={{ padding: 6, marginRight: 4 }}
        accessibilityRole="button"
        accessibilityLabel={t("a11y.back")}
      >
        <Ionicons name="arrow-back" size={22} color={tokens.text.primary} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text accessibilityRole="header" style={styles.title}>
          {t("cart.title")}
        </Text>
        {merchant?.name ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {t("cart.fromMerchant", { name: merchant.name })}
          </Text>
        ) : null}
      </View>
      {lines.length > 0 && (
        <TouchableOpacity
          onPress={confirmClear}
          accessibilityRole="button"
          accessibilityLabel={t("cart.clearCta")}
          style={{ padding: 6 }}
        >
          <Ionicons name="trash-outline" size={20} color={tokens.text.muted} />
        </TouchableOpacity>
      )}
    </View>
  );

  if (lines.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
        {renderHeader()}
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={tokens.brand.default}
              colors={[tokens.brand.default]}
            />
          }
        >
          <EmptyState
            icon="bag-handle-outline"
            title={t("cart.emptyTitle")}
            subtitle={t("cart.emptyHint")}
            ctaLabel={t("cart.browseCta")}
            onCta={goBrowse}
            fill={false}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      {renderHeader()}

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 140 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={tokens.brand.default}
            colors={[tokens.brand.default]}
          />
        }
      >
        {lines.map((line) => (
          <View key={line.lineId} style={styles.card}>
            {line.imageUrl ? (
              <Image source={{ uri: line.imageUrl }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.thumbFallback]}>
                <Ionicons name="fast-food-outline" size={24} color={tokens.text.muted} />
              </View>
            )}
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.lineName} numberOfLines={2}>
                {line.quantity}× {line.name}
                {line.variantSummary ? ` · ${line.variantSummary}` : ""}
              </Text>
              {(line.selectedOptions || []).map((g) => (
                <Text key={g.groupId} style={styles.lineOpt} numberOfLines={1}>
                  {g.groupName}: {g.items.map((i) => i.itemName).join(", ")}
                </Text>
              ))}
              {line.specialInstructions ? (
                <Text style={styles.lineInstructions} numberOfLines={2}>
                  “{line.specialInstructions}”
                </Text>
              ) : null}
              <View style={styles.chipsRow}>
                {isGrocery && line.substitution ? (
                  <View style={styles.subChip}>
                    <Ionicons name="swap-horizontal" size={11} color={tokens.category.groceries.icon} />
                    <Text style={styles.subChipText}>
                      {substitutionLabel(line.substitution, t)}
                    </Text>
                  </View>
                ) : null}
                {line.requiresPrescription ? (
                  <View style={styles.rxChip}>
                    <Ionicons name="medkit-outline" size={11} color={tokens.status.warningStrong} />
                    <Text style={styles.rxChipText}>{t("merchant.rx")}</Text>
                  </View>
                ) : null}
              </View>
            </View>
            <View style={{ alignItems: "flex-end", marginLeft: 8 }}>
              <Text style={styles.linePrice}>{money(line.lineTotal)}</Text>
              <View style={{ flexDirection: "row", marginTop: 8 }}>
                <TouchableOpacity
                  onPress={() => editLine(line)}
                  disabled={editingLineId === line.lineId}
                  style={styles.lineBtn}
                  accessibilityRole="button"
                  accessibilityLabel={t("a11y.editItem")}
                  accessibilityState={{ disabled: editingLineId === line.lineId }}
                >
                  {editingLineId === line.lineId ? (
                    <ActivityIndicator size="small" color={tokens.brand.default} />
                  ) : (
                    <Ionicons name="pencil" size={14} color={tokens.brand.default} />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => onRemove(line.lineId)}
                  style={styles.lineBtn}
                  accessibilityRole="button"
                  accessibilityLabel={t("a11y.removeItem")}
                >
                  <Ionicons name="trash" size={14} color={tokens.status.errorStrong} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}

        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>{t("cart.subtotal")}</Text>
          <Text style={styles.totalsValue}>{money(total)}</Text>
        </View>
        <Text style={styles.totalsHint}>{t("cart.feesHint")}</Text>
      </ScrollView>

      <View style={styles.footer}>
        <View style={{ flex: 1 }}>
          <Text style={styles.fCount}>{t("merchant.itemCount", { count: lines.length })}</Text>
          <Text style={styles.fTotal}>{money(total)}</Text>
        </View>
        <TouchableOpacity
          style={styles.checkoutBtn}
          onPress={goCheckout}
          accessibilityRole="button"
          accessibilityLabel={t("cart.checkoutCta")}
        >
          <Text style={styles.checkoutText}>{t("cart.checkoutCta")}</Text>
          <Ionicons name="arrow-forward" size={16} color={tokens.text.onBrand} style={{ marginLeft: 6 }} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (tokens) => StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: tokens.bg.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.border.default,
  },
  title: { fontSize: 17, fontWeight: "800", color: tokens.text.primary },
  subtitle: { fontSize: 12, color: tokens.text.muted, marginTop: 2 },

  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: tokens.bg.surface,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: tokens.border.default,
  },
  thumb: { width: 56, height: 56, borderRadius: 12, backgroundColor: tokens.bg.surfaceMuted },
  thumbFallback: { alignItems: "center", justifyContent: "center" },
  lineName: { fontSize: 14, color: tokens.text.primary, fontWeight: "700" },
  lineOpt: { fontSize: 12, color: tokens.text.muted, marginTop: 2 },
  lineInstructions: { fontSize: 12, fontStyle: "italic", color: tokens.text.muted, marginTop: 2 },
  linePrice: { fontSize: 14, color: tokens.text.primary, fontWeight: "700" },
  lineBtn: { padding: 6 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 6 },
  subChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tokens.category.groceries.bg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginRight: 6,
    marginTop: 2,
  },
  subChipText: { color: tokens.category.groceries.icon, fontSize: 11, fontWeight: "700", marginLeft: 4 },
  rxChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tokens.status.warningSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginRight: 6,
    marginTop: 2,
  },
  rxChipText: { color: tokens.status.warningStrong, fontSize: 11, fontWeight: "700", marginLeft: 4 },

  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: tokens.border.default,
  },
  totalsLabel: { fontSize: 14, color: tokens.text.muted, fontWeight: "600" },
  totalsValue: { fontSize: 16, color: tokens.text.primary, fontWeight: "800" },
  totalsHint: { fontSize: 11, color: tokens.text.muted, marginTop: 6 },

  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: tokens.bg.surface,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: tokens.border.default,
    flexDirection: "row",
    alignItems: "center",
  },
  fCount: { fontSize: 12, color: tokens.text.muted },
  fTotal: { fontSize: 18, fontWeight: "800", color: tokens.text.primary },
  checkoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tokens.brand.default,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 12,
  },
  checkoutText: { color: tokens.text.onBrand, fontWeight: "800", fontSize: 14 },
});
