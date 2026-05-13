/**
 * ShopsScreen — the long-tail category list reached from the Shops tile on
 * Home. Home surfaces only Food / Grocery / Pharmacy as direct tiles; every
 * other active `MerchantCategory` from the backend lives here (Fashion,
 * Shoes, Electronics, and anything an admin adds later).
 *
 * Tap a card → MerchantBrowse with the same category params HomeScreen passes.
 */

import React, { useCallback, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector, useDispatch } from "react-redux";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import { fetchCategories } from "../../store/slices/categoriesSlice";
import SkeletonLoader from "../../components/SkeletonLoader";
import EmptyState from "../../components/EmptyState";
import { resolveCategoryIcon } from "../../lib/categoryIcons";
import { colors } from "../../theme";

// Slugs that live on the home grid — exclude them from Shops so we don't
// duplicate. Stays in sync with HomeScreen's HOME_CATEGORY_SLUGS by value
// (small enough not to warrant a shared constant).
const HOME_CATEGORY_SLUGS = new Set(["restaurant", "grocery", "pharmacy"]);

const tintBackground = (hex) => {
  if (!hex || typeof hex !== "string") return "#F3F4F6";
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return `${hex}14`;
  return "#F3F4F6";
};

export default function ShopsScreen() {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { list: categories, loading, error } = useSelector((s) => s.categories);
  const { latitude, longitude } = useSelector((s) => s.location);

  // The home screen also fetches; this is a no-op if the store is fresh, but
  // covers the case where Shops is opened from a deep link before Home runs.
  useEffect(() => {
    if (!categories || categories.length === 0) dispatch(fetchCategories());
  }, [dispatch, categories]);

  const shopCategories = useMemo(
    () =>
      (categories || [])
        .filter((c) => c.isActive && !HOME_CATEGORY_SLUGS.has(c.slug))
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [categories]
  );

  const handleRefresh = useCallback(() => dispatch(fetchCategories()), [dispatch]);

  const goToCategory = (cat) => {
    navigation.navigate("MerchantBrowse", {
      categorySlug: cat.slug,
      categoryName: cat.name,
      lat: latitude,
      lng: longitude,
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 14,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ padding: 6, marginRight: 4 }}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.back")}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text
            accessibilityRole="header"
            style={{ fontSize: 17, fontWeight: "800", color: colors.text }}
          >
            {t("shops.title")}
          </Text>
          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
            {t("shops.subtitle")}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        {loading && shopCategories.length === 0 ? (
          <View style={{ gap: 12 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonLoader key={i} width="100%" height={72} radius={16} />
            ))}
          </View>
        ) : error && shopCategories.length === 0 ? (
          <EmptyState
            icon="cloud-offline-outline"
            title={t("home.servicesError")}
            subtitle={t("home.servicesRetry")}
            ctaLabel={t("home.servicesRetry")}
            onCta={handleRefresh}
          />
        ) : shopCategories.length === 0 ? (
          <EmptyState
            icon="storefront-outline"
            title={t("shops.empty")}
            subtitle={t("shops.emptyHint")}
          />
        ) : (
          <View style={{ gap: 12 }}>
            {shopCategories.map((cat) => {
              const iconName = resolveCategoryIcon(cat);
              const color = cat.color || "#7C3AED";
              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => goToCategory(cat)}
                  accessibilityRole="button"
                  accessibilityLabel={cat.name}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: colors.surface,
                    borderRadius: 18,
                    padding: 14,
                    borderWidth: 1.5,
                    borderColor: colors.border,
                  }}
                >
                  <View
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 14,
                      backgroundColor: tintBackground(color),
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 14,
                      borderWidth: 1.5,
                      borderColor: color + "25",
                    }}
                  >
                    <MaterialCommunityIcons name={iconName} size={26} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ fontSize: 15, fontWeight: "800", color: colors.text, letterSpacing: -0.3 }}
                      numberOfLines={1}
                    >
                      {cat.name}
                    </Text>
                    {cat.description ? (
                      <Text
                        style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}
                        numberOfLines={1}
                      >
                        {cat.description}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
