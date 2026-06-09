/**
 * SavedAddressesScreen - Phase 6 CRUD list.
 *
 * Replaces the legacy single-textarea "Primary Address" editor with a real
 * address book backed by `/addresses`. Used as the picker source from:
 *   - CreateRequestScreen (PACKAGE pickup + dropoff)
 *   - CheckoutScreen (MERCHANT_ORDER dropoff)
 *
 * Picker mode: when `route.params.onSelect` is provided, taps return the
 * address via the callback and pop the screen (mirrors the existing
 * LocationPicker/SavedAddresses contract used by CreateRequest/Checkout).
 *
 * "Add new" / "Edit" both navigate to LocationPicker to pick lat/lng + the
 * human address, then we POST/PATCH /addresses and pop back.
 */

import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import { useTheme } from "../../theme";
import {
  fetchAddresses,
  createAddress,
  updateAddress,
  setDefaultAddress,
  deleteAddress,
} from "../../store/slices/addressesSlice";

const LABEL_SUGGESTIONS = ["Home", "Work", "Mum's place", "Other"];

export default function SavedAddressesScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { tokens, isDark } = useTheme();
  const { list, isLoading, isMutating, isLoaded } = useSelector((s) => s.addresses);

  // Picker mode - when set, taps return via callback rather than editing.
  const onSelect = route.params?.onSelect;
  const pickerMode = typeof onSelect === "function";

  // Edit modal state
  const [editing, setEditing] = useState(null); // { id?, label, address, lat, lng, placeId, isDefault }
  const [labelDraft, setLabelDraft] = useState("");
  const [isDefaultDraft, setIsDefaultDraft] = useState(false);

  // `useFocusEffect` covers both the initial mount and the return-from-
  // LocationPicker case, so a separate `useEffect(fetchAddresses)` would
  // double-fetch on first render.
  useFocusEffect(
    useCallback(() => {
      dispatch(fetchAddresses());
    }, [dispatch]),
  );

  const openLocationPicker = (existing) => {
    navigation.navigate("LocationPicker", {
      // LocationPicker returns { latitude, longitude, address } - no placeId.
      onSelect: (loc) => {
        const newLat = loc.latitude ?? loc.lat;
        const newLng = loc.longitude ?? loc.lng;
        // If the picked coords differ from the existing row, the previously
        // stored placeId no longer points at this location - drop it. The
        // backend will accept null and the row stays in a consistent state.
        const coordsChanged = !existing
          || (typeof newLat === "number" && Math.abs(newLat - existing.lat) > 1e-6)
          || (typeof newLng === "number" && Math.abs(newLng - existing.lng) > 1e-6);
        setEditing({
          id: existing?.id,
          label: existing?.label || "",
          address: loc.address || existing?.address || "",
          lat: newLat ?? existing?.lat,
          lng: newLng ?? existing?.lng,
          placeId: coordsChanged ? (loc.placeId || null) : (loc.placeId || existing?.placeId || null),
          isDefault: existing?.isDefault || false,
        });
        setLabelDraft(existing?.label || "Home");
        setIsDefaultDraft(existing?.isDefault || false);
      },
    });
  };

  const handlePickerTap = async (item) => {
    if (!pickerMode) return;
    // Optionally mark as default-on-use? Skip - user controls default explicitly.
    onSelect({
      id: item.id,
      label: item.label,
      address: item.address,
      lat: item.lat,
      lng: item.lng,
      latitude: item.lat,
      longitude: item.lng,
      placeId: item.placeId,
    });
    navigation.goBack();
  };

  const saveEdit = async () => {
    if (!editing) return;
    const label = labelDraft.trim();
    if (!label) {
      Toast.show({ type: "error", text1: "Label required" });
      return;
    }
    if (!editing.address || editing.lat == null || editing.lng == null) {
      Toast.show({ type: "error", text1: "Pick a location" });
      return;
    }

    const payload = {
      label,
      address: editing.address,
      lat: editing.lat,
      lng: editing.lng,
      placeId: editing.placeId || undefined,
      isDefault: isDefaultDraft,
    };

    const action = editing.id
      ? await dispatch(updateAddress({ id: editing.id, ...payload }))
      : await dispatch(createAddress(payload));

    if (action.meta.requestStatus === "fulfilled") {
      setEditing(null);
      Toast.show({ type: "success", text1: t("addresses.saved") });
    } else {
      Toast.show({ type: "error", text1: action.payload || "Failed to save" });
    }
  };

  const handleDelete = (item) => {
    Alert.alert(
      `Delete "${item.label}"?`,
      "This address will be removed from your saved addresses.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const action = await dispatch(deleteAddress(item.id));
            if (action.meta.requestStatus === "fulfilled") {
              Toast.show({ type: "success", text1: "Address deleted" });
            }
          },
        },
      ],
    );
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => (pickerMode ? handlePickerTap(item) : null)}
      activeOpacity={pickerMode ? 0.8 : 1}
      style={{
        backgroundColor: tokens.bg.surface,
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: item.isDefault ? tokens.brand.default : tokens.border.default,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View
          style={{
            width: 38, height: 38, borderRadius: 19,
            backgroundColor: `${tokens.brand.default}20`,
            alignItems: "center", justifyContent: "center", marginRight: 12,
          }}
        >
          <Ionicons name={item.label === "Home" ? "home" : item.label === "Work" ? "briefcase" : "location"} size={18} color={tokens.brand.default} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={{ fontSize: 15, fontWeight: "800", color: tokens.text.primary }}>{item.label}</Text>
            {item.isDefault && (
              <View style={{ marginLeft: 8, backgroundColor: `${tokens.brand.default}20`, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                <Text style={{ fontSize: 10, fontWeight: "700", color: tokens.brand.default }}>DEFAULT</Text>
              </View>
            )}
          </View>
          <Text numberOfLines={2} style={{ fontSize: 13, color: tokens.text.muted, marginTop: 3 }}>
            {item.address}
          </Text>
        </View>
        {!pickerMode && (
          <TouchableOpacity onPress={() => openLocationPicker(item)} style={{ padding: 6 }} hitSlop={8}>
            <Ionicons name="create-outline" size={20} color={tokens.text.muted} />
          </TouchableOpacity>
        )}
      </View>

      {!pickerMode && (
        <View style={{ flexDirection: "row", marginTop: 12, gap: 8 }}>
          {!item.isDefault && (
            <TouchableOpacity
              onPress={() => dispatch(setDefaultAddress(item.id))}
              style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center", backgroundColor: tokens.bg.surfaceMuted }}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.text.primary }}>Make default</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => handleDelete(item)}
            style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center", backgroundColor: tokens.status.errorSoft }}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.status.errorStrong }}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );

  // In picker mode an empty saved-address list is a dead end. Surface a
  // one-tap escape hatch that hands control straight to LocationPicker and
  // pipes the picked location back through the caller's onSelect - same
  // contract as a saved-address tap, just without persistence.
  const pickOneOffLocation = () => {
    if (!pickerMode) return;
    navigation.navigate("LocationPicker", {
      onSelect: (loc) => {
        onSelect({
          label: "Selected location",
          address: loc.address,
          lat: loc.latitude,
          lng: loc.longitude,
          latitude: loc.latitude,
          longitude: loc.longitude,
        });
        navigation.goBack();
      },
    });
  };

  const renderEmpty = () =>
    isLoading ? null : (
      <View style={{ alignItems: "center", paddingVertical: 48, paddingHorizontal: 24 }}>
        <Ionicons name="location-outline" size={48} color={tokens.text.muted} />
        <Text style={{ marginTop: 12, fontWeight: "800", fontSize: 16, color: tokens.text.primary }}>
          No saved addresses yet
        </Text>
        <Text style={{ marginTop: 6, fontSize: 13, color: tokens.text.muted, textAlign: "center", lineHeight: 19 }}>
          Save your Home and Work addresses to speed up future deliveries.
        </Text>
        {pickerMode && (
          <TouchableOpacity
            onPress={pickOneOffLocation}
            style={{ marginTop: 20, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, backgroundColor: tokens.brand.default }}
          >
            <Text style={{ color: tokens.text.onBrand, fontWeight: "800", fontSize: 13 }}>
              Pick a location on the map
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={tokens.bg.canvas} />
      <View style={{ height: 4, backgroundColor: tokens.brand.default }} />

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel={t("a11y.back")}
            style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: tokens.bg.surfaceMuted, alignItems: "center", justifyContent: "center", marginRight: 14 }}
          >
            <Ionicons name="arrow-back" size={20} color={tokens.text.primary} />
          </TouchableOpacity>
          <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: "900", color: tokens.text.primary, letterSpacing: -0.5 }}>
            {pickerMode ? t("request.pickAddress") : t("addresses.title")}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => openLocationPicker(null)}
          accessibilityRole="button"
          accessibilityLabel={t("addresses.addCta")}
          style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: tokens.brand.default }}
        >
          <Ionicons name="add" size={16} color={tokens.text.onBrand} />
          <Text style={{ marginLeft: 4, fontSize: 13, fontWeight: "700", color: tokens.text.onBrand }}>{t("common.next")}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={list}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 }}
        ListEmptyComponent={renderEmpty}
        ListHeaderComponent={
          isLoading && list.length === 0 ? <ActivityIndicator color={tokens.brand.default} style={{ marginTop: 24 }} /> : null
        }
        ListFooterComponent={
          pickerMode && list.length > 0 ? (
            <TouchableOpacity
              onPress={pickOneOffLocation}
              style={{ marginTop: 6, paddingVertical: 12, borderRadius: 12, alignItems: "center", borderWidth: 1.5, borderStyle: "dashed", borderColor: tokens.border.default }}
            >
              <Text style={{ fontWeight: "700", color: tokens.brand.default, fontSize: 13 }}>
                <Ionicons name="map-outline" size={13} />  Pick a one-off location
              </Text>
            </TouchableOpacity>
          ) : null
        }
      />

      {/* Label + default modal - used both for new entries and edits. */}
      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: "flex-end", backgroundColor: tokens.overlay.scrim }}>
          <View style={{ backgroundColor: tokens.bg.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
              <Text style={{ flex: 1, fontSize: 18, fontWeight: "800", color: tokens.text.primary }}>
                {editing?.id ? "Edit address" : "New address"}
              </Text>
              <TouchableOpacity onPress={() => setEditing(null)}>
                <Ionicons name="close" size={22} color={tokens.text.muted} />
              </TouchableOpacity>
            </View>

            <View style={{ backgroundColor: tokens.bg.surfaceMuted, borderRadius: 12, padding: 12, marginBottom: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="location" size={16} color={tokens.brand.default} />
                <Text numberOfLines={2} style={{ marginLeft: 8, flex: 1, fontSize: 13, color: tokens.text.primary }}>
                  {editing?.address || "-"}
                </Text>
              </View>
            </View>

            <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.text.muted, textTransform: "uppercase", marginBottom: 6 }}>
              Label
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 10 }}>
              {LABEL_SUGGESTIONS.map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setLabelDraft(s)}
                  style={{
                    marginRight: 8, marginBottom: 8,
                    paddingHorizontal: 12, paddingVertical: 6,
                    borderRadius: 999,
                    backgroundColor: labelDraft === s ? tokens.brand.default : tokens.bg.surfaceMuted,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "700", color: labelDraft === s ? tokens.text.onBrand : tokens.text.primary }}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              value={labelDraft}
              onChangeText={setLabelDraft}
              placeholder="Custom label"
              placeholderTextColor={tokens.text.muted}
              maxLength={60}
              style={{ borderWidth: 1, borderColor: tokens.border.default, borderRadius: 10, padding: 12, fontSize: 14, color: tokens.text.primary, marginBottom: 14 }}
            />

            <TouchableOpacity
              onPress={() => setIsDefaultDraft((v) => !v)}
              style={{ flexDirection: "row", alignItems: "center", marginBottom: 18 }}
            >
              <View
                style={{
                  width: 22, height: 22, borderRadius: 6,
                  borderWidth: 2, borderColor: isDefaultDraft ? tokens.brand.default : tokens.border.default,
                  backgroundColor: isDefaultDraft ? tokens.brand.default : "transparent",
                  alignItems: "center", justifyContent: "center", marginRight: 10,
                }}
              >
                {isDefaultDraft && <Ionicons name="checkmark" size={14} color={tokens.text.onBrand} />}
              </View>
              <Text style={{ fontSize: 14, color: tokens.text.primary }}>Set as default address</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={saveEdit}
              disabled={isMutating}
              style={{ backgroundColor: tokens.brand.default, paddingVertical: 14, borderRadius: 12, alignItems: "center" }}
            >
              {isMutating ? (
                <ActivityIndicator color={tokens.text.onBrand} />
              ) : (
                <Text style={{ color: tokens.text.onBrand, fontWeight: "800", fontSize: 15 }}>
                  {editing?.id ? "Save changes" : "Save address"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
