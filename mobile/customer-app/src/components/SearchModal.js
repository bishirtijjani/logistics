/**
 * Unified search modal (Home header → full-screen search).
 *
 * Debounced fetch against `/search` (hybrid full-text + trigram backend).
 * Premium UX layers on top of the raw results:
 *   - Discovery state (empty query): recent searches + category shortcuts so the
 *     screen is never a dead end.
 *   - Rich result rows: real merchant logos / product images, rating, distance,
 *     price-from, and an open/closed badge (closed rows dimmed, consistent with
 *     MerchantBrowse).
 *   - Results grouped into "Stores" and "Items" sections.
 *   - Skeleton loading, and a real error state (network failures no longer
 *     masquerade as "no results").
 *
 * Recent searches persist on-device via lib/recentSearches (AsyncStorage).
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Modal, View, Text, TextInput, TouchableOpacity, SectionList, Image,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import api from "../services/api";
import { useTheme } from "../theme";
import { resolveCategoryIcon } from "../lib/categoryIcons";
import {
  getRecentSearches, addRecentSearch, removeRecentSearch, clearRecentSearches,
} from "../lib/recentSearches";
import SkeletonLoader from "./SkeletonLoader";
import { InModalToast } from "./toastShared";

const DEBOUNCE_MS = 300;
const MIN_QUERY = 2;

const formatDistance = (km) => (km < 10 ? km.toFixed(1) : String(Math.round(km)));

export default function SearchModal({ visible, onClose, onNavigate, categorySlug = null, categoryName = null }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [recent, setRecent] = useState([]);
  const [navigatingId, setNavigatingId] = useState(null); // product being hydrated on tap
  const timerRef = useRef(null);
  const inputRef = useRef(null);
  const reqIdRef = useRef(0); // discard stale responses

  // Category shortcuts for the discovery state - already in the store from Home.
  const categories = useSelector((s) => s.categories?.list) || [];
  // locationSlice stores lat/lng directly on the slice root, not nested.
  const userLat = useSelector((s) => s.location?.latitude);
  const userLng = useSelector((s) => s.location?.longitude);

  const trimmed = query.trim();
  const isDiscovery = trimmed.length < MIN_QUERY;

  // ── lifecycle ────────────────────────────────────────────
  useEffect(() => {
    if (!visible) {
      // Bump the request id so any in-flight /search response that lands after
      // we close is discarded by the stale-id guard, avoiding setState-after-unmount.
      reqIdRef.current += 1;
      if (timerRef.current) clearTimeout(timerRef.current);
      setQuery("");
      setResults([]);
      setLoading(false);
      setError(false);
      return undefined;
    }
    getRecentSearches().then(setRecent);
    // Tiny focus delay so the modal animation finishes before the keyboard.
    const focusTimer = setTimeout(() => inputRef.current?.focus(), 200);
    return () => clearTimeout(focusTimer);
  }, [visible]);

  // ── debounced fetch ──────────────────────────────────────
  const runSearch = useCallback(() => {
    const myReq = ++reqIdRef.current;
    setLoading(true);
    setError(false);
    (async () => {
      try {
        const params = new URLSearchParams({ q: trimmed });
        // Scope to the current category section ("Food", "Groceries", …) when the
        // modal is opened from a category browse screen.
        if (categorySlug) params.append("category", categorySlug);
        if (typeof userLat === "number" && typeof userLng === "number") {
          params.append("lat", String(userLat));
          params.append("lng", String(userLng));
          params.append("radius", "15");
        }
        const envelope = await api.get(`/search?${params.toString()}`);
        if (myReq !== reqIdRef.current) return; // a newer query superseded us
        setResults(envelope?.data?.results || []);
      } catch (_) {
        if (myReq === reqIdRef.current) {
          setResults([]);
          setError(true); // distinguish a failed fetch from a genuine empty
        }
      } finally {
        if (myReq === reqIdRef.current) setLoading(false);
      }
    })();
  }, [trimmed, userLat, userLng, categorySlug]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!visible) return undefined;
    if (isDiscovery) {
      setResults([]);
      setLoading(false);
      setError(false);
      return undefined;
    }
    timerRef.current = setTimeout(runSearch, DEBOUNCE_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [trimmed, visible, runSearch, isDiscovery]);

  // ── actions ──────────────────────────────────────────────
  const commitRecent = (term) => { addRecentSearch(term).then(setRecent); };

  const handleTap = async (item) => {
    commitRecent(trimmed);

    if (item.kind === "merchant") {
      onClose?.();
      onNavigate?.("MerchantMenu", { merchantId: item.id });
      return;
    }

    // Products: /search returns a partial product (one variant, no optionGroups),
    // the wrong shape for ProductDetail. Hydrate the full product from the
    // merchant payload (variants + optionGroups + category slug), then open the
    // detail screen. If anything goes wrong, fall back to the store menu with the
    // product highlighted so the tap is never a dead end.
    const merchantId = item.merchantId || item.merchant?.id;
    if (!merchantId) return;
    if (navigatingId) return; // ignore double-taps while a hydrate is in flight

    setNavigatingId(item.id);
    try {
      const envelope = await api.get(`/merchants/${merchantId}`);
      const merchant = envelope?.data;
      const product = merchant?.products?.find((p) => p.id === item.id);
      onClose?.();
      if (product) {
        onNavigate?.("ProductDetail", {
          product,
          merchantId,
          merchant,
          merchantCategorySlug: merchant?.category?.slug || null,
        });
      } else {
        onNavigate?.("MerchantMenu", { merchantId, highlightProductId: item.id });
      }
    } catch (_) {
      onClose?.();
      onNavigate?.("MerchantMenu", { merchantId, highlightProductId: item.id });
    } finally {
      setNavigatingId(null);
    }
  };

  const handleCategory = (cat) => {
    onClose?.();
    onNavigate?.("MerchantBrowse", {
      categorySlug: cat.slug,
      categoryName: cat.name,
      lat: userLat,
      lng: userLng,
    });
  };

  const onRemoveRecent = (term) => { removeRecentSearch(term).then(setRecent); };
  const onClearRecent = () => { clearRecentSearches().then(setRecent); };

  // ── rows ─────────────────────────────────────────────────
  // Plain render helpers (not nested components) so they don't remount / reload
  // images on every parent render.
  const thumb = ({ uri, fallbackIcon, tint, bg }) => (
    uri ? (
      <Image
        source={{ uri }}
        style={{ width: 46, height: 46, borderRadius: 12, marginRight: 12, backgroundColor: tokens.bg.surfaceMuted }}
      />
    ) : (
      <View style={{ width: 46, height: 46, borderRadius: 12, marginRight: 12, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={fallbackIcon} size={20} color={tint} />
      </View>
    )
  );

  const metaDot = () => (
    <Text style={{ fontSize: 12, color: tokens.text.muted, marginHorizontal: 5 }}>·</Text>
  );

  const renderMerchant = (item) => {
    const closed = item.isOpen === false;
    const rating = typeof item.averageRating === "number" ? item.averageRating : null;
    const dist = item._distanceKm;
    return (
      <TouchableOpacity
        onPress={() => handleTap(item)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}. ${closed ? t("merchant.closed") : t("merchant.openNow")}`}
        style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 11, opacity: closed ? 0.55 : 1 }}
      >
        {thumb({ uri: item.logoUrl, fallbackIcon: "storefront", tint: tokens.brand.default, bg: `${tokens.brand.default}20` })}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14.5, fontWeight: "700", color: tokens.text.primary }} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 3 }}>
            {item.category?.name ? (
              <Text style={{ fontSize: 12, color: tokens.text.muted }} numberOfLines={1}>{item.category.name}</Text>
            ) : null}
            {rating != null && rating > 0 && (
              <>
                {item.category?.name ? metaDot() : null}
                <Ionicons name="star" size={11} color="#FFA500" />
                <Text style={{ fontSize: 12, color: tokens.text.muted, marginLeft: 3 }}>{rating.toFixed(1)}</Text>
              </>
            )}
            {typeof dist === "number" && (
              <>
                {metaDot()}
                <Text style={{ fontSize: 12, color: tokens.text.muted }}>{t("search.distanceKm", { km: formatDistance(dist) })}</Text>
              </>
            )}
          </View>
        </View>
        <View style={{ marginLeft: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: closed ? tokens.status.errorSoft : tokens.status.successSoft }}>
          <Text style={{ fontSize: 10, fontWeight: "800", color: closed ? tokens.status.error : tokens.status.successStrong }}>
            {closed ? t("merchant.closed") : t("merchant.openNow")}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderProduct = (item) => {
    const priceFrom = Number(item.variants?.[0]?.price ?? item.basePrice ?? 0);
    const dist = item._distanceKm;
    const merchantClosed = item.merchant?.isOpen === false;
    return (
      <TouchableOpacity
        onPress={() => handleTap(item)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={item.name}
        style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 11, opacity: merchantClosed ? 0.55 : 1 }}
      >
        {thumb({ uri: item.imageUrl || item.merchant?.logoUrl, fallbackIcon: "fast-food", tint: tokens.status.warningStrong, bg: tokens.status.warningSoft })}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14.5, fontWeight: "700", color: tokens.text.primary }} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 3 }}>
            {item.merchant?.name ? (
              <Text style={{ fontSize: 12, color: tokens.text.muted, flexShrink: 1 }} numberOfLines={1}>{item.merchant.name}</Text>
            ) : null}
            {typeof dist === "number" && (
              <>
                {item.merchant?.name ? metaDot() : null}
                <Text style={{ fontSize: 12, color: tokens.text.muted }}>{t("search.distanceKm", { km: formatDistance(dist) })}</Text>
              </>
            )}
          </View>
        </View>
        {item.id === navigatingId ? (
          <ActivityIndicator size="small" color={tokens.brand.default} style={{ marginLeft: 12 }} />
        ) : priceFrom > 0 ? (
          <Text style={{ marginLeft: 12, fontSize: 14, fontWeight: "800", color: tokens.brand.strong }}>
            ₦{priceFrom.toLocaleString("en-NG")}
          </Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  // ── sections ─────────────────────────────────────────────
  const merchants = results.filter((r) => r.kind === "merchant");
  const products = results.filter((r) => r.kind === "product");
  const sections = [];
  if (merchants.length) sections.push({ key: "merchant", title: t("search.merchants"), data: merchants });
  if (products.length) sections.push({ key: "product", title: t("search.products"), data: products });

  const renderSectionHeader = ({ section }) => (
    <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6, backgroundColor: tokens.bg.canvas, flexDirection: "row", alignItems: "center" }}>
      <Text style={{ fontSize: 12, fontWeight: "800", color: tokens.text.muted, letterSpacing: 0.6 }}>
        {section.title.toUpperCase()}
      </Text>
      <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.text.muted, marginLeft: 6 }}>
        · {section.data.length}
      </Text>
    </View>
  );

  // ── discovery (empty query) ──────────────────────────────
  // When scoped to a category browse screen the shortcuts are redundant (the
  // user is already inside that category), so only show them for global search.
  const discoveryCategories = categorySlug
    ? []
    : (categories || []).filter((c) => c.isActive).slice(0, 8);

  const placeholder = categoryName
    ? t("search.scopedPh", { category: categoryName })
    : t("search.ph");

  const renderDiscovery = () => (
    <View style={{ paddingTop: 8 }}>
      {recent.length > 0 && (
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <Text style={{ fontSize: 12, fontWeight: "800", color: tokens.text.muted, letterSpacing: 0.6 }}>
              {t("search.recent").toUpperCase()}
            </Text>
            <TouchableOpacity onPress={onClearRecent} hitSlop={8} accessibilityRole="button" accessibilityLabel={t("search.clearRecent")}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.brand.default }}>{t("search.clearRecent")}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {recent.map((term) => (
              <View
                key={term}
                style={{ flexDirection: "row", alignItems: "center", backgroundColor: tokens.bg.surfaceMuted, borderRadius: 999, paddingLeft: 12, paddingRight: 6, paddingVertical: 7 }}
              >
                <TouchableOpacity onPress={() => setQuery(term)} accessibilityRole="button" accessibilityLabel={term}>
                  <Text style={{ fontSize: 13, color: tokens.text.primary, fontWeight: "500" }}>{term}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => onRemoveRecent(term)} hitSlop={6} accessibilityRole="button" accessibilityLabel={t("search.removeRecent")} style={{ marginLeft: 6 }}>
                  <Ionicons name="close" size={14} color={tokens.text.muted} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      )}

      {discoveryCategories.length > 0 && (
        <View style={{ paddingHorizontal: 16, paddingTop: recent.length > 0 ? 22 : 8 }}>
          <Text style={{ fontSize: 12, fontWeight: "800", color: tokens.text.muted, letterSpacing: 0.6, marginBottom: 12 }}>
            {t("search.popular").toUpperCase()}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {discoveryCategories.map((cat) => {
              const color = cat.color || tokens.brand.default;
              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => handleCategory(cat)}
                  accessibilityRole="button"
                  accessibilityLabel={cat.name}
                  style={{ flexDirection: "row", alignItems: "center", backgroundColor: tokens.bg.surface, borderWidth: 1, borderColor: tokens.border.default, borderRadius: 14, paddingVertical: 9, paddingHorizontal: 12 }}
                >
                  <MaterialCommunityIcons name={resolveCategoryIcon(cat)} size={17} color={color} style={{ marginRight: 8 }} />
                  <Text style={{ fontSize: 13.5, fontWeight: "700", color: tokens.text.primary }}>{cat.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {recent.length === 0 && discoveryCategories.length === 0 && (
        <View style={{ padding: 40, alignItems: "center" }}>
          <Ionicons name="search" size={36} color={tokens.text.muted} />
          <Text style={{ marginTop: 10, color: tokens.text.muted, fontSize: 13, textAlign: "center" }}>{placeholder}</Text>
        </View>
      )}
    </View>
  );

  const renderSkeleton = () => (
    <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 14 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center" }}>
          <SkeletonLoader width={46} height={46} radius={12} />
          <View style={{ flex: 1, marginLeft: 12, gap: 6 }}>
            <SkeletonLoader width="60%" height={13} radius={6} />
            <SkeletonLoader width="40%" height={11} radius={6} />
          </View>
        </View>
      ))}
    </View>
  );

  const renderError = () => (
    <View style={{ padding: 40, alignItems: "center" }}>
      <Ionicons name="cloud-offline-outline" size={40} color={tokens.text.muted} />
      <Text style={{ marginTop: 12, fontSize: 15, fontWeight: "700", color: tokens.text.primary }}>{t("search.errorTitle")}</Text>
      <Text style={{ marginTop: 4, color: tokens.text.muted, fontSize: 13, textAlign: "center" }}>{t("search.errorHint")}</Text>
      <TouchableOpacity
        onPress={runSearch}
        accessibilityRole="button"
        style={{ marginTop: 16, backgroundColor: tokens.brand.default, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 10 }}
      >
        <Text style={{ color: tokens.text.onBrand, fontWeight: "700", fontSize: 13 }}>{t("search.retry")}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderNoResults = () => (
    <View style={{ padding: 40, alignItems: "center" }}>
      <Ionicons name="search-outline" size={40} color={tokens.text.muted} />
      <Text style={{ marginTop: 12, fontSize: 15, fontWeight: "700", color: tokens.text.primary, textAlign: "center" }} numberOfLines={2}>
        {t("search.noResults", { query: trimmed })}
      </Text>
      <Text style={{ marginTop: 4, color: tokens.text.muted, fontSize: 13, textAlign: "center" }}>{t("search.noResultsHint")}</Text>
    </View>
  );

  // ── body selection ───────────────────────────────────────
  let body;
  if (isDiscovery) {
    body = renderDiscovery();
  } else if (loading && results.length === 0) {
    body = renderSkeleton();
  } else if (error) {
    body = renderError();
  } else if (sections.length === 0) {
    body = renderNoResults();
  } else {
    body = (
      <SectionList
        sections={sections}
        keyExtractor={(item) => `${item.kind}-${item.id}`}
        renderItem={({ item }) => (item.kind === "merchant" ? renderMerchant(item) : renderProduct(item))}
        renderSectionHeader={renderSectionHeader}
        keyboardShouldPersistTaps="handled"
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: 24 }}
        ItemSeparatorComponent={() => <View style={{ height: 1, marginLeft: 74, backgroundColor: tokens.border.default }} />}
      />
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, backgroundColor: tokens.bg.canvas }}
      >
        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 12, flexDirection: "row", alignItems: "center", backgroundColor: tokens.bg.surface, borderBottomWidth: 1, borderBottomColor: tokens.border.default }}>
          <TouchableOpacity onPress={onClose} style={{ padding: 6, marginRight: 6 }} accessibilityRole="button" accessibilityLabel={t("a11y.close")}>
            <Ionicons name="arrow-back" size={22} color={tokens.text.primary} />
          </TouchableOpacity>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: tokens.bg.surfaceMuted, borderRadius: 12, paddingHorizontal: 12 }}>
            <Ionicons name="search" size={16} color={tokens.text.muted} />
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => {
                // Force-fire (skip the debounce) when the user taps the keyboard's
                // search button, and record the term in recent history.
                if (trimmed.length >= MIN_QUERY) {
                  if (timerRef.current) clearTimeout(timerRef.current);
                  commitRecent(trimmed);
                  runSearch();
                }
              }}
              placeholder={placeholder}
              accessibilityLabel={t("search.title")}
              placeholderTextColor={tokens.text.muted}
              style={{ flex: 1, paddingVertical: 10, marginLeft: 8, fontSize: 14, color: tokens.text.primary }}
              returnKeyType="search"
              autoCorrect={false}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery("")} hitSlop={8} accessibilityRole="button" accessibilityLabel={t("a11y.close")}>
                <Ionicons name="close-circle" size={16} color={tokens.text.muted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {body}
        <InModalToast />
      </KeyboardAvoidingView>
    </Modal>
  );
}
