/**
 * Phase 6 unified search modal.
 *
 * Debounced fetch against `/search` (pg_trgm fuzzy backend). Renders
 * merchants and products in one list with a "kind" chip; tap routes to
 * MerchantMenu / ProductDetail.
 *
 * Used by HomeScreen - opened from the header search bar.
 */

import React, { useEffect, useRef, useState } from "react";
import {
  Modal, View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import api from "../services/api";
import { colors } from "../theme";
import { InModalToast } from "./toastShared";

const DEBOUNCE_MS = 300;
const MIN_QUERY = 2;

export default function SearchModal({ visible, onClose, onNavigate }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);
  const inputRef = useRef(null);
  const reqIdRef = useRef(0); // discard stale responses

  // locationSlice stores lat/lng directly on the slice root, not nested.
  const userLat = useSelector((s) => s.location?.latitude);
  const userLng = useSelector((s) => s.location?.longitude);

  useEffect(() => {
    if (!visible) {
      // Bump the request id so any in-flight /search response that lands
      // after we close the modal is discarded by the stale-id guard below,
      // avoiding a setState-after-unmount warning.
      reqIdRef.current += 1;
      if (timerRef.current) clearTimeout(timerRef.current);
      setQuery("");
      setResults([]);
      setLoading(false);
      return undefined;
    }
    // Tiny focus delay so the modal animation finishes before the keyboard.
    const t = setTimeout(() => inputRef.current?.focus(), 200);
    return () => clearTimeout(t);
  }, [visible]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!visible) return undefined;
    if (query.trim().length < MIN_QUERY) {
      setResults([]);
      setLoading(false);
      return undefined;
    }
    timerRef.current = setTimeout(async () => {
      const myReq = ++reqIdRef.current;
      setLoading(true);
      try {
        const params = new URLSearchParams({ q: query.trim() });
        if (typeof userLat === "number" && typeof userLng === "number") {
          params.append("lat", String(userLat));
          params.append("lng", String(userLng));
          params.append("radius", "15");
        }
        const envelope = await api.get(`/search?${params.toString()}`);
        // Discard if a newer query has been kicked off.
        if (myReq !== reqIdRef.current) return;
        setResults(envelope?.data?.results || []);
      } catch (_) {
        if (myReq === reqIdRef.current) setResults([]);
      } finally {
        if (myReq === reqIdRef.current) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, visible, userLat, userLng]);

  const handleTap = (item) => {
    onClose?.();
    // Both merchants and products route to MerchantMenu - search returns
    // only a partial product (one variant, no optionGroups), which is the
    // wrong shape for ProductDetailScreen. MerchantMenu hydrates the full
    // product list and the user can re-tap from there.
    if (item.kind === "merchant") {
      onNavigate?.("MerchantMenu", { merchantId: item.id });
    } else if (item.kind === "product") {
      const merchantId = item.merchantId || item.merchant?.id;
      if (merchantId) {
        onNavigate?.("MerchantMenu", { merchantId, highlightProductId: item.id });
      }
    }
  };

  const renderItem = ({ item }) => {
    const isProduct = item.kind === "product";
    const subtitle = isProduct
      ? (item.merchant?.name || "")
      : (item.category?.name || "");
    const priceFrom = isProduct
      ? Number(item.variants?.[0]?.price ?? 0)
      : null;
    return (
      <TouchableOpacity
        onPress={() => handleTap(item)}
        style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}
      >
        <View
          style={{
            width: 38, height: 38, borderRadius: 10,
            backgroundColor: isProduct ? "#FEF3C7" : `${colors.primary}20`,
            alignItems: "center", justifyContent: "center", marginRight: 12,
          }}
        >
          <Ionicons name={isProduct ? "pricetag" : "storefront"} size={18} color={isProduct ? "#92400E" : colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text, flex: 1 }} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={{ marginLeft: 8, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: isProduct ? "#FEF3C7" : `${colors.primary}20` }}>
              <Text style={{ fontSize: 9, fontWeight: "800", color: isProduct ? "#92400E" : colors.primary, letterSpacing: 0.5 }}>
                {isProduct ? t("search.products").toUpperCase() : t("search.merchants").toUpperCase()}
              </Text>
            </View>
          </View>
          {subtitle ? (
            <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }} numberOfLines={1}>{subtitle}</Text>
          ) : null}
        </View>
        {priceFrom != null && priceFrom > 0 && (
          <Text style={{ marginLeft: 12, fontSize: 13, fontWeight: "800", color: colors.primaryStrong }}>
            ₦{priceFrom.toLocaleString("en-NG")}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    if (query.trim().length < MIN_QUERY) {
      return (
        <View style={{ padding: 40, alignItems: "center" }}>
          <Ionicons name="search" size={36} color={colors.textMuted} />
          <Text style={{ marginTop: 10, color: colors.textMuted, fontSize: 13, textAlign: "center" }}>
            {t("search.ph")}
          </Text>
        </View>
      );
    }
    return (
      <View style={{ padding: 40, alignItems: "center" }}>
        <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t("search.noResults")}</Text>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ paddingTop: 50, paddingHorizontal: 16, paddingBottom: 12, flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <TouchableOpacity
            onPress={onClose}
            style={{ padding: 6, marginRight: 6 }}
            accessibilityRole="button"
            accessibilityLabel={t("a11y.close")}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceMuted, borderRadius: 12, paddingHorizontal: 12 }}>
            <Ionicons name="search" size={16} color={colors.textMuted} />
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => {
                // Force-fire the search instead of waiting for the debounce
                // when the user explicitly taps the keyboard's search button.
                if (query.trim().length >= MIN_QUERY) {
                  if (timerRef.current) clearTimeout(timerRef.current);
                  // Re-run the same fetch logic by nudging the query reference;
                  // the effect re-evaluates on next render anyway. Setting it
                  // to its own value would be a no-op, so we trim trailing
                  // whitespace to guarantee a render.
                  setQuery((q) => q.trim());
                }
              }}
              placeholder={t("search.ph")}
              accessibilityLabel={t("search.title")}
              placeholderTextColor={colors.textMuted}
              style={{ flex: 1, paddingVertical: 10, marginLeft: 8, fontSize: 14, color: colors.text }}
              returnKeyType="search"
              autoCorrect={false}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery("")} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {loading && (
          <View style={{ paddingVertical: 12 }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}

        <FlatList
          data={results}
          keyExtractor={(item) => `${item.kind}-${item.id}`}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={renderEmpty}
        />
        <InModalToast />
      </KeyboardAvoidingView>
    </Modal>
  );
}
