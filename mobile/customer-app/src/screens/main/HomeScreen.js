import React, { useState, useEffect, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector, useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";
import { fetchWallet } from "../../store/slices/walletSlice";
import { hydrateLocation } from "../../store/slices/locationSlice";
import { fetchCategories, hydrateCategoriesFromCache } from "../../store/slices/categoriesSlice";
import { fetchUnreadCount } from "../../store/slices/notificationsSlice";
import {
  fetchActiveRequest,
  fetchBanners,
  fetchRecentActivity,
  activeRequestFromSocket,
} from "../../store/slices/homeSlice";
import SearchModal from "../../components/SearchModal";
import EmptyState from "../../components/EmptyState";
import SkeletonLoader from "../../components/SkeletonLoader";
import socketService from "../../services/socket";
import { statusDisplay } from "../../lib/requestStatus";
import { resolveCategoryIcon } from "../../lib/categoryIcons";
import {
  Ionicons,
  MaterialCommunityIcons,
  FontAwesome5,
} from "@expo/vector-icons";
import Toast from "react-native-toast-message";

// UNIFIED REQUEST ARCHITECTURE
// Everything is a Request. The category list is data-driven from /api/categories;
// PACKAGE is the only static tile (no merchant — pure courier).

// Home shows only these top-level categories; everything else lives behind
// the Shops aggregator tile. Order here is the order they appear on the grid.
const HOME_CATEGORY_SLUGS = ["restaurant", "grocery", "pharmacy"];

// Static tile for the Shops aggregator. Tapping opens ShopsScreen which lists
// every active category not surfaced on home (fashion, shoes, electronics, …).
const SHOPS_TILE = {
  id: "SHOPS",
  isShops: true,
  nameKey: "home.shops",
  icon: "shopping",
  color: "#9333EA",
  bg: "#F5F3FF",
  iconType: "MaterialCommunityIcons",
};

// Static tile for the courier flow. Always rendered last on the home screen.
// `nameKey` + `descriptionKey` are resolved via t() at render time so a
// locale change re-renders the label without rebuilding this object.
const PACKAGE_TILE = {
  id: "PACKAGE",
  isPackage: true,
  nameKey: "home.package",
  descriptionKey: "home.packageDescription",
  icon: "moped",
  color: "#2563EB",
  bg: "#EFF6FF",
  iconType: "MaterialCommunityIcons",
};

// Derive a soft background tint from a hex color for the tile chip.
const tintBackground = (hex) => {
  if (!hex || typeof hex !== "string") return "#F3F4F6";
  // Append alpha 0x14 (~8%) to a 6-char hex; if not hex, fall back.
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return `${hex}14`;
  return "#F3F4F6";
};

// Icon resolution is shared with ShopsScreen via `lib/categoryIcons.js`.

// VTU services list. `key` ties the row to the i18n catalog (utility.*) and to
// the screen name in the navigation switch below. `name` field removed in
// favor of t() lookup at render time.
const vtuServices = [
  {
    id: "v1",
    key: "airtime",
    screen: "Airtime",
    icon: "phone-portrait-outline",
    color: "#EA580C",
    type: "Ionicons",
  },
  {
    id: "v2",
    key: "data",
    screen: "Data",
    icon: "wifi-outline",
    color: "#2563EB",
    type: "Ionicons",
  },
  {
    id: "v3",
    key: "electricity",
    screen: "Electricity",
    icon: "flash-outline",
    color: "#D97706",
    type: "Ionicons",
  },
  {
    id: "v4",
    key: "transfer",
    screen: null,
    icon: "swap-horizontal-outline",
    color: "#059669",
    type: "Ionicons",
  },
];

function resolveIcon(item) {
  if (item.iconType === "MaterialCommunityIcons") return MaterialCommunityIcons;
  if (item.iconType === "FontAwesome5") return FontAwesome5;
  return Ionicons;
}

function formatNaira(amount) {
  return (
    "\u20A6" +
    Number(amount).toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export default function HomeScreen({ navigation }) {
  const { t } = useTranslation();
  const { user } = useSelector((state) => state.auth);
  const { balance } = useSelector((state) => state.wallet);
  const { latitude, longitude } = useSelector((state) => state.location);
  const { list: categories, loading: categoriesLoading, error: categoriesError } = useSelector(
    (state) => state.categories,
  );
  const dispatch = useDispatch();
  const [showBalance, setShowBalance] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  const [searchVisible, setSearchVisible] = useState(false);
  const { activeRequest, banners, recentActivity } = useSelector((s) => s.home);

  // One-time per-mount hydrations (cheap settings / cache reads).
  useEffect(() => {
    dispatch(hydrateLocation());
    dispatch(hydrateCategoriesFromCache());
    dispatch(fetchCategories());
  }, [dispatch]);

  // Refresh per-user state whenever Home regains focus — covers cold open,
  // tab switch, deep-link back, and pull-from-deep-screen returns. Without
  // this, a user who places a request and navigates back sees stale
  // wallet/balance + activeRequest until they kill the app.
  useFocusEffect(
    useCallback(() => {
      dispatch(fetchWallet());
      dispatch(fetchUnreadCount());
      dispatch(fetchActiveRequest());
      dispatch(fetchBanners());
      dispatch(fetchRecentActivity());
    }, [dispatch]),
  );

  // Live-update the active-request banner from socket status changes — keeps
  // the home banner in sync without a refetch on every status hop. Each
  // emitter already includes `status` in its payload (per Phase 5 hardening
  // §5.4), so we forward it untouched — don't synthesize a status here.
  useEffect(() => {
    const handle = (data) => dispatch(activeRequestFromSocket(data));
    const unsubStatus = socketService.onRequestStatusChanged(handle);
    const unsubRider = socketService.onRequestRiderAssigned(handle);
    const unsubCancelled = socketService.onRequestCancelled(handle);
    const unsubCompleted = socketService.onRequestCompleted(handle);
    return () => {
      unsubStatus(); unsubRider(); unsubCancelled(); unsubCompleted();
    };
  }, [dispatch]);

  // Home shows a curated set of categories (Food / Grocery / Pharmacy), plus
  // Shops (aggregator for the long tail) and Package (static courier flow).
  // The full category list lives behind Shops.
  const homeCategoryTiles = HOME_CATEGORY_SLUGS
    .map((slug) => (categories || []).find((c) => c.slug === slug && c.isActive))
    .filter(Boolean)
    .map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      icon: resolveCategoryIcon(c),
      color: c.color || "#7C3AED",
      bg: tintBackground(c.color),
      iconType: "MaterialCommunityIcons",
      description: c.description || "",
      hasPreparation: c.hasPreparation,
    }));
  const tiles = [...homeCategoryTiles, SHOPS_TILE, PACKAGE_TILE];

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: "transparent" }}
      edges={["top"]}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAFA" />
      <View style={{ height: 4, backgroundColor: "#EA580C" }} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48 }}
      >
        {/* Header — search bar takes the row, bell + profile on the right.
            The location chip is gone; address is asked when actually needed
            (checkout, request creation) rather than parked at the top. */}
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 4,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <TouchableOpacity
            onPress={() => setSearchVisible(true)}
            accessibilityRole="search"
            accessibilityLabel={t("common.search")}
            accessibilityHint={t("home.searchPlaceholder")}
            style={{
              flex: 1,
              backgroundColor: "#fff",
              borderRadius: 999,
              paddingHorizontal: 16,
              paddingVertical: 12,
              flexDirection: "row",
              alignItems: "center",
              borderWidth: 1,
              borderColor: "#EEF0F2",
              shadowColor: "#000",
              shadowOpacity: 0.05,
              shadowOffset: { width: 0, height: 2 },
              shadowRadius: 8,
              elevation: 1,
              marginRight: 10,
            }}
          >
            <Ionicons name="search" size={18} color="#6B7280" />
            <Text
              numberOfLines={1}
              style={{
                color: "#9CA3AF",
                fontSize: 14,
                marginLeft: 10,
                fontWeight: "500",
                flex: 1,
              }}
            >
              {t("home.searchPlaceholder")}
            </Text>
          </TouchableOpacity>
          <NotificationBell navigation={navigation} />
          <TouchableOpacity
            onPress={() => navigation.navigate("Profile")}
            accessibilityRole="button"
            accessibilityLabel={t("a11y.profile")}
            accessibilityHint={t("a11y.settings")}
            // The TouchableOpacity itself has no borderRadius so the gear
            // badge can sit outside the avatar circle without Android
            // clipping the overflow. The dark circle below carries the
            // borderRadius for the actual visual.
            style={{
              marginLeft: 8,
              width: 42,
              height: 42,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                backgroundColor: "#09090b",
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="person" size={18} color="#fff" />
            </View>
            {/* Settings gear badge — bottom-right corner of the avatar.
                Sits inside the parent TouchableOpacity (no borderRadius) so
                taps anywhere on the badge open Profile via the parent
                without a second tap target. */}
            <View
              style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                width: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: "#EA580C",
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 2,
                borderColor: "#FAFAFA",
              }}
            >
              <Ionicons name="settings-sharp" size={9} color="#fff" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Active Request Banner — appears when the customer has an in-flight order. */}
        {activeRequest && (
          <ActiveRequestBanner request={activeRequest} navigation={navigation} />
        )}

        {/* Wallet Pill */}
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`${t("home.wallet")} ${showBalance ? formatNaira(balance) : ""}`.trim()}
          accessibilityHint={t("home.viewWallet")}
          style={{
            marginHorizontal: 20,
            marginTop: 28,
            backgroundColor: "#09090b",
            borderRadius: 20,
            paddingHorizontal: 18,
            paddingVertical: 18,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            shadowColor: "#09090b",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.2,
            shadowRadius: 12,
            elevation: 6,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                backgroundColor: "#ffffff15",
                padding: 10,
                borderRadius: 12,
                marginRight: 12,
              }}
            >
              <Ionicons name="wallet" size={20} color="#E5E7EB" />
            </View>
            <View>
              <Text
                style={{
                  color: "#6B7280",
                  fontSize: 11,
                  fontWeight: "600",
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                  marginBottom: 2,
                }}
              >
                {t("home.wallet")}
              </Text>
              <Text
                style={{
                  color: "#fff",
                  fontSize: 18,
                  fontWeight: "900",
                  letterSpacing: -0.5,
                }}
              >
                {showBalance
                  ? formatNaira(balance)
                  : "\u20A6 \u2022\u2022\u2022\u2022"}
              </Text>
            </View>
          </View>
          <View
            style={{
              backgroundColor: "#EA580C",
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 10,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: "#fff",
                fontSize: 13,
                fontWeight: "800",
                marginRight: 4,
              }}
            >
              {t("home.viewWallet")}
            </Text>
            <Ionicons name="chevron-forward" size={14} color="#fff" />
          </View>
        </TouchableOpacity>

          {/* Request Types - Unified Architecture */}
        <View style={{ paddingHorizontal: 20, marginTop: 40 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 22,
            }}
          >
            <Text
              accessibilityRole="header"
              style={{
                fontSize: 20,
                fontWeight: "900",
                color: "#09090b",
                letterSpacing: -0.5,
              }}
            >
              {t("home.sectionServices")}
            </Text>
            <View
              style={{
                width: 30,
                height: 3.5,
                backgroundColor: "#EA580C",
                borderRadius: 2,
              }}
            />
          </View>
          {categoriesLoading && homeCategoryTiles.length === 0 ? (
            // Skeleton tiles instead of a spinner — gives the user a sense of
            // the layout that's about to arrive (much faster perceived load).
            <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 24 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <View key={i} style={{ width: "33.33%", alignItems: "center" }}>
                  <SkeletonLoader width={78} height={78} radius={36} style={{ marginBottom: 10 }} />
                  <SkeletonLoader width={56} height={12} />
                </View>
              ))}
            </View>
          ) : categoriesError && homeCategoryTiles.length === 0 ? (
            <View style={{ paddingVertical: 16, alignItems: "center" }}>
              <Text style={{ color: "#DC2626", fontSize: 13, marginBottom: 8 }}>
                {t("home.servicesError")}
              </Text>
              <TouchableOpacity
                onPress={() => dispatch(fetchCategories())}
                accessibilityRole="button"
                accessibilityLabel={t("home.servicesRetry")}
              >
                <Text style={{ color: "#EA580C", fontSize: 13, fontWeight: "600" }}>
                  {t("home.servicesRetry")}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              rowGap: 24,
            }}
          >
            {tiles.map((item, idx) => {
              const Icon = resolveIcon(item);
              // Irregular pebble shapes — four asymmetric radius presets cycled
              // by index so adjacent tiles never share the same silhouette.
              const blobShapes = [
                { borderTopLeftRadius: 46, borderTopRightRadius: 30, borderBottomRightRadius: 44, borderBottomLeftRadius: 34 },
                { borderTopLeftRadius: 30, borderTopRightRadius: 48, borderBottomRightRadius: 32, borderBottomLeftRadius: 46 },
                { borderTopLeftRadius: 40, borderTopRightRadius: 44, borderBottomRightRadius: 28, borderBottomLeftRadius: 48 },
                { borderTopLeftRadius: 48, borderTopRightRadius: 34, borderBottomRightRadius: 46, borderBottomLeftRadius: 28 },
              ];
              const blob = blobShapes[idx % blobShapes.length];
              // Static tiles (PACKAGE, SHOPS) carry a translation key; dynamic
              // category tiles use the admin-supplied `name` directly.
              const displayName = item.nameKey ? t(item.nameKey) : item.name;
              const handlePress = () => {
                if (item.isPackage) {
                  // Package: direct courier flow, no merchant.
                  navigation.navigate("CreateRequest", {
                    requestType: "PACKAGE",
                    hasMerchant: false,
                  });
                  return;
                }
                if (item.isShops) {
                  // Shops: aggregator that opens the long-tail category list.
                  navigation.navigate("Shops");
                  return;
                }
                // Any merchant category: browse merchants filtered by category.
                navigation.navigate("MerchantBrowse", {
                  categorySlug: item.slug,
                  categoryName: item.name,
                  lat: latitude,
                  lng: longitude,
                });
              };
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={handlePress}
                  accessibilityRole="button"
                  accessibilityLabel={displayName}
                  accessibilityState={{ disabled: !!item.comingSoon }}
                  // 33.33% gives 3 tiles per row; the 4th + 5th wrap onto a
                  // second row, left-aligned beneath the first two tiles.
                  style={{ width: "33.33%", alignItems: "center" }}
                >
                  {/* Pebble-shaped tile — solid burnt orange with a near-black
                      hairline border. Icons are white for contrast. */}
                  <View
                    style={{
                      width: 78,
                      height: 78,
                      backgroundColor: "#EA580C",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 10,
                      borderWidth: 1.5,
                      borderColor: "#09090b",
                      shadowColor: "#EA580C",
                      shadowOpacity: 0.32,
                      shadowOffset: { width: 0, height: 8 },
                      shadowRadius: 14,
                      elevation: 5,
                      ...blob,
                    }}
                  >
                    <Icon name={item.icon} size={34} color="#FFFFFF" />
                  </View>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color: "#09090b",
                      textAlign: "center",
                      opacity: item.comingSoon ? 0.6 : 1,
                      letterSpacing: -0.2,
                    }}
                  >
                    {displayName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Bills & Utilities */}
        <View style={{ paddingHorizontal: 20, marginTop: 40 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 22,
            }}
          >
            <Text
              accessibilityRole="header"
              style={{
                fontSize: 20,
                fontWeight: "900",
                color: "#09090b",
                letterSpacing: -0.5,
              }}
            >
              {t("home.sectionBills")}
            </Text>
            <View
              style={{
                width: 30,
                height: 3.5,
                backgroundColor: "#EA580C",
                borderRadius: 2,
              }}
            />
          </View>
          <View
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            {vtuServices.map((item) => {
              const Icon = resolveIcon(item);
              const label = t(`utility.${item.key}`);
              const handlePress = () => {
                if (item.screen) {
                  navigation.navigate(item.screen);
                } else if (item.key === "transfer") {
                  Toast.show({
                    type: "info",
                    text1: t("common.comingSoon"),
                    text2: t("utility.transferComingSoon"),
                  });
                }
              };
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={handlePress}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  style={{ width: "23%", alignItems: "center" }}
                >
                  <View
                    style={{
                      width: 64,
                      height: 64,
                      backgroundColor: "#09090b",
                      borderRadius: 20,
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 10,
                    }}
                  >
                    <Icon name={item.icon} size={26} color={item.color} />
                  </View>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: "#09090b",
                      textAlign: "center",
                    }}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Promo Banner — admin-managed via /api/banners.
            Hidden entirely when no banners are eligible (per spec). */}
        {banners.length > 0 && (
          <PromoBanner banner={banners[0]} navigation={navigation} />
        )}

        {/* Recent Activity — last 5 across requests + wallet transactions. */}
        <RecentActivity items={recentActivity} navigation={navigation} />
      </ScrollView>

      <SearchModal
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        onNavigate={(name, params) => navigation.navigate(name, params)}
      />

      {/* Wallet Drawer Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "#00000055",
          }}
        >
          <TouchableOpacity
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
          />
          <View
            style={{
              backgroundColor: "#fff",
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: 40,
              minHeight: "55%",
            }}
          >
            <View
              style={{
                width: 44,
                height: 5,
                backgroundColor: "#E5E7EB",
                borderRadius: 3,
                alignSelf: "center",
                marginBottom: 24,
              }}
            />
            <Text
              accessibilityRole="header"
              style={{
                fontSize: 19,
                fontWeight: "900",
                color: "#09090b",
                letterSpacing: -0.5,
                marginBottom: 4,
              }}
            >
              {t("home.walletSheet.title")}
            </Text>
            <Text style={{ color: "#6B7280", fontSize: 13, marginBottom: 20 }}>
              {t("home.walletSheet.subtitle")}
            </Text>
            <View
              style={{
                backgroundColor: "#09090b",
                borderRadius: 20,
                padding: 22,
                marginBottom: 24,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  right: 36,
                  width: 4,
                  height: "100%",
                  backgroundColor: "#EA580C",
                }}
              />
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <Text
                  style={{
                    color: "#6B7280",
                    fontSize: 11,
                    fontWeight: "700",
                    letterSpacing: 1.4,
                    textTransform: "uppercase",
                  }}
                >
                  {t("home.wallet")}
                </Text>
                <TouchableOpacity
                  onPress={() => setShowBalance(!showBalance)}
                  accessibilityRole="button"
                  accessibilityLabel={t("a11y.toggleBalance")}
                  accessibilityState={{ selected: !showBalance }}
                >
                  <Ionicons
                    name={showBalance ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color="#6B7280"
                  />
                </TouchableOpacity>
              </View>
              <Text
                style={{
                  color: "#fff",
                  fontSize: 38,
                  fontWeight: "900",
                  letterSpacing: -1.5,
                }}
              >
                {showBalance
                  ? formatNaira(balance)
                  : "\u20A6 \u2022\u2022\u2022\u2022"}
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                onPress={() => {
                  setModalVisible(false);
                  navigation.navigate("FundWallet");
                }}
                accessibilityRole="button"
                accessibilityLabel={t("home.walletSheet.fund")}
                style={{
                  flex: 1,
                  backgroundColor: "#EA580C",
                  paddingVertical: 15,
                  borderRadius: 14,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}
                >
                  {t("home.walletSheet.fund")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t("home.walletSheet.send")}
                style={{
                  flex: 1,
                  backgroundColor: "#F3F4F6",
                  paddingVertical: 15,
                  borderRadius: 14,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{ color: "#09090b", fontWeight: "800", fontSize: 15 }}
                >
                  {t("home.walletSheet.send")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Phase 5 — notification bell with unread badge. Tapping opens the
// Notification Center. The badge is driven by the notifications slice; it
// auto-increments when `notification:new` arrives via socket (notificationsBus).
function NotificationBell({ navigation }) {
  const { t } = useTranslation();
  const unreadCount = useSelector((s) => s.notifications.unreadCount);
  return (
    <TouchableOpacity
      onPress={() => navigation.navigate("NotificationCenter")}
      style={{
        width: 40,
        height: 40,
        backgroundColor: "#fff",
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1.5,
        borderColor: "#E5E7EB",
      }}
      accessibilityRole="button"
      accessibilityLabel={
        unreadCount > 0
          ? t("a11y.unreadCount", { count: unreadCount })
          : t("a11y.notifications")
      }
    >
      <Ionicons name="notifications-outline" size={20} color="#09090b" />
      {unreadCount > 0 && (
        <View
          style={{
            position: "absolute",
            top: 4,
            right: 4,
            minWidth: 16,
            height: 16,
            paddingHorizontal: 4,
            borderRadius: 9,
            backgroundColor: "#EF4444",
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 2,
            borderColor: "#fff",
          }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// Phase 6 — active-request banner. Self-updates from the home slice; the
// slice is fed by socket-status-changed listeners in HomeScreen's useEffect.
function ActiveRequestBanner({ request, navigation }) {
  const { t } = useTranslation();
  // Phase 8 — pass the merchant's category slug so the banner reads
  // "Pharmacist preparing…" / "Picking your groceries" instead of the
  // generic "Preparing your order" for pharmacy/grocery orders.
  const pill = statusDisplay(request.status, request.type, request.merchant?.category?.slug);
  const isPackage = request.type === "PACKAGE";
  const merchantName =
    request.merchant?.name ||
    (isPackage ? t("home.active.packageFallback") : t("home.active.orderFallback"));
  return (
    <TouchableOpacity
      onPress={() => navigation.navigate("RequestTracking", { requestId: request.id })}
      accessibilityRole="button"
      accessibilityLabel={`${pill.label}. ${merchantName}`}
      accessibilityHint={t("home.active.trackCta")}
      style={{
        marginHorizontal: 20,
        marginTop: 14,
        backgroundColor: "#fff",
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: "#EA580C30",
        flexDirection: "row",
        alignItems: "center",
        shadowColor: "#EA580C",
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 2,
      }}
    >
      <View
        style={{
          width: 44, height: 44, borderRadius: 22,
          backgroundColor: pill.bg,
          alignItems: "center", justifyContent: "center", marginRight: 12,
        }}
      >
        <Ionicons name={isPackage ? "cube" : "fast-food"} size={20} color={pill.color} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: pill.bg }}>
            <Text style={{ fontSize: 10, fontWeight: "800", color: pill.color }}>{pill.label}</Text>
          </View>
        </View>
        <Text numberOfLines={1} style={{ marginTop: 4, fontSize: 14, fontWeight: "800", color: "#09090b" }}>
          {merchantName}
        </Text>
        <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12, color: "#6B7280" }}>
          {request.dropoffAddress || t("home.active.trackingFallback")}
        </Text>
      </View>
      <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: "#EA580C" }}>
        <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>{t("home.active.trackCta")}</Text>
      </View>
    </TouchableOpacity>
  );
}

// Phase 6 — promo banner sourced from /api/banners. Tap deep-links via
// `banner.deepLink` (matches notify.service route conventions) or via an
// in-app screen name.
function PromoBanner({ banner, navigation }) {
  const { t } = useTranslation();
  const handleTap = () => {
    if (!banner.deepLink) return;
    // Local schemes like `/wallet`, `/orders`, `customerapp://request/abc`.
    if (banner.deepLink.startsWith("customerapp://") || banner.deepLink.startsWith("http")) {
      // Defer to NavigationContainer's deep-link handler via Linking.openURL.
      try {
        const { Linking } = require("react-native");
        Linking.openURL(banner.deepLink);
      } catch (_) {}
      return;
    }
    const path = banner.deepLink;
    if (path.startsWith("/request/")) {
      navigation.navigate("RequestTracking", { requestId: path.split("/")[2] });
    } else if (path === "/wallet") {
      navigation.navigate("MainTabs", { screen: "WalletTab" });
    } else if (path === "/orders") {
      navigation.navigate("MainTabs", { screen: "OrdersTab" });
    } else if (path.startsWith("/utility/")) {
      const kind = path.split("/")[2];
      const map = { airtime: "Airtime", data: "Data", cable: "Cable", electricity: "Electricity" };
      if (map[kind]) navigation.navigate(map[kind]);
    }
  };

  const bg = banner.bgColor || "#09090b";
  return (
    <TouchableOpacity
      onPress={handleTap}
      activeOpacity={banner.deepLink ? 0.85 : 1}
      style={{
        marginHorizontal: 20,
        marginTop: 40,
        backgroundColor: bg,
        borderRadius: 22,
        padding: 22,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      <View style={{ flex: 1 }}>
        {banner.subtitle ? (
          <Text
            style={{
              color: "#EA580C",
              fontSize: 10,
              fontWeight: "800",
              letterSpacing: 1.5,
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            {banner.subtitle}
          </Text>
        ) : null}
        <Text
          style={{
            color: "#fff",
            fontSize: 20,
            fontWeight: "900",
            letterSpacing: -0.5,
            lineHeight: 26,
          }}
          numberOfLines={2}
        >
          {banner.title}
        </Text>
      </View>
      {banner.deepLink && (
        <View style={{ backgroundColor: "#EA580C", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 }}>
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>{t("common.continue")}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// Phase 6 — Recent Activity: 5 most recent requests + transactions interleaved.
function RecentActivity({ items, navigation }) {
  const { t, i18n } = useTranslation();
  const handleTap = (it) => {
    if (it.kind === "request") {
      navigation.navigate("RequestTracking", { requestId: it.id });
    } else if (it.kind === "transaction") {
      navigation.navigate("TransactionHistory", { highlightRef: it.raw?.reference });
    }
  };

  // Locale-aware date formatting. Hausa shares Latin/Western numbers and
  // calendar with English in this app's scope, so en-NG / ha-NG produce the
  // same output for short dates — but we still pass the actual locale so the
  // intl runtime gets month names right when those land in the catalog.
  const formatDate = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    const now = new Date();
    const localeTag = i18n.language === "ha" ? "ha-NG" : "en-NG";
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return d.toLocaleTimeString(localeTag, { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString(localeTag, { day: "numeric", month: "short" });
  };

  return (
    <View style={{ paddingHorizontal: 20, marginTop: 40, marginBottom: 28 }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 18 }}>
        <Text accessibilityRole="header" style={{ flex: 1, fontSize: 20, fontWeight: "900", color: "#09090b", letterSpacing: -0.5 }}>
          {t("home.sectionRecent")}
        </Text>
        {items.length > 0 && (
          <TouchableOpacity
            onPress={() => navigation.navigate("MainTabs", { screen: "OrdersTab" })}
            accessibilityRole="link"
            accessibilityLabel={t("home.seeAll")}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#EA580C" }}>{t("home.seeAll")}</Text>
          </TouchableOpacity>
        )}
      </View>

      {items.length === 0 ? (
        <EmptyState
          icon="time-outline"
          title={t("states.empty.activity")}
          subtitle={t("states.empty.activityHint")}
          fill={false}
        />
      ) : (
        <View style={{ backgroundColor: "#fff", borderRadius: 18, borderWidth: 1.5, borderColor: "#E5E7EB", overflow: "hidden" }}>
          {items.map((it, idx) => (
            <TouchableOpacity
              key={`${it.kind}-${it.id}`}
              onPress={() => handleTap(it)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderTopWidth: idx === 0 ? 0 : 1,
                borderTopColor: "#F3F4F6",
              }}
            >
              <View
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  backgroundColor: it.kind === "request" ? `${"#EA580C"}20` : "#DCFCE7",
                  alignItems: "center", justifyContent: "center", marginRight: 12,
                }}
              >
                <Ionicons
                  name={
                    it.kind !== "request"
                      ? "wallet-outline"
                      : it.raw?.type === "PACKAGE"
                        ? "cube-outline"
                        : "fast-food-outline"
                  }
                  size={18}
                  color={it.kind === "request" ? "#EA580C" : "#15803D"}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: "700", color: "#09090b" }}>
                  {it.title}
                </Text>
                <Text numberOfLines={1} style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>
                  {it.subtitle} · {formatDate(it.at)}
                </Text>
              </View>
              {it.amount > 0 && (
                <Text style={{ fontSize: 13, fontWeight: "800", color: "#09090b", marginLeft: 8 }}>
                  ₦{Number(it.amount).toLocaleString("en-NG")}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}
