import React, { useCallback, useEffect, useState } from "react";
import { goBackOr } from "../../lib/goBack";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { useNavigation } from "@react-navigation/native";
import Toast from "react-native-toast-message";
import { useTheme } from "../../theme";
import { useT } from "../../i18n/useT";
import {
  fetchBeneficiaries,
  deleteBeneficiary,
} from "../../store/slices/beneficiariesSlice";

/**
 * Beneficiaries - saved bank accounts the rider has withdrawn to before.
 * Tap to pre-fill WithdrawScreen; long-press / chevron menu deletes.
 */
export default function BeneficiariesScreen() {
  const { tokens } = useTheme();
  const { t } = useT();
  const dispatch = useDispatch();
  const navigation = useNavigation();

  const byId = useSelector((s) => s.beneficiaries?.byId) || {};
  const allIds = useSelector((s) => s.beneficiaries?.allIds) || [];
  const isLoading = useSelector((s) => s.beneficiaries?.isLoading);
  const list = allIds.map((id) => byId[id]).filter(Boolean);

  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    dispatch(fetchBeneficiaries());
  }, [dispatch]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await dispatch(fetchBeneficiaries()).unwrap?.().catch(() => {}); }
    finally { setRefreshing(false); }
  }, [dispatch]);

  const handleDelete = async (id) => {
    setDeletingId(id);
    const res = await dispatch(deleteBeneficiary(id));
    setDeletingId(null);
    setConfirmDelete(null);
    if (deleteBeneficiary.fulfilled.match(res)) {
      Toast.show({ type: "success", text1: t("beneficiaries.deleted", "Beneficiary removed") });
    } else {
      Toast.show({
        type: "error",
        text1: t("beneficiaries.deleteFailed", "Couldn't remove"),
        text2: typeof res.payload === "string" ? res.payload : t("common.tryAgain", "Try again."),
      });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <View
        style={{
          flexDirection: "row", alignItems: "center", justifyContent: "space-between",
          paddingHorizontal: 14, paddingVertical: 12,
          backgroundColor: tokens.bg.surface,
          borderBottomWidth: 1, borderBottomColor: tokens.border.default,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            onPress={() => goBackOr(navigation)}
            accessibilityRole="button"
            accessibilityLabel={t("common.back", "Back")}
            hitSlop={8}
            style={{ padding: 4 }}
          >
            <Ionicons name="arrow-back" size={22} color={tokens.text.primary} />
          </TouchableOpacity>
          <Text accessibilityRole="header" style={{ marginLeft: 10, fontSize: 17, fontWeight: "800", color: tokens.text.primary }}>
            {t("beneficiaries.title", "Beneficiaries")}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate("Withdraw")}
          accessibilityRole="button"
          accessibilityLabel={t("beneficiaries.add", "Add beneficiary")}
          hitSlop={6}
          style={{ padding: 4 }}
        >
          <Ionicons name="add" size={24} color={tokens.brand.default} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={list}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ padding: 14 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.brand.default} />}
        renderItem={({ item }) => (
          <View
            style={{
              backgroundColor: tokens.bg.surface,
              borderRadius: 14, padding: 14, marginBottom: 10,
              borderWidth: 1, borderColor: tokens.border.default,
              flexDirection: "row", alignItems: "center",
            }}
          >
            <View
              style={{
                width: 38, height: 38, borderRadius: 19,
                backgroundColor: tokens.brand.soft,
                alignItems: "center", justifyContent: "center",
                marginRight: 12,
              }}
            >
              <Ionicons name="person-outline" size={18} color={tokens.brand.strong} />
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate("Withdraw", {
                bankCode: item.bankCode,
                bankName: item.bankName,
                accountNumber: item.accountNumber,
                accountName: item.accountName,
              })}
              accessibilityRole="button"
              accessibilityLabel={t("beneficiaries.useAria", "Withdraw to {{name}}", { name: item.accountName || item.name })}
              style={{ flex: 1 }}
            >
              <Text style={{ fontSize: 14, fontWeight: "700", color: tokens.text.primary }} numberOfLines={1}>
                {item.accountName || item.name}
              </Text>
              <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 2 }}>
                {item.bankName || item.bankCode}
              </Text>
              <Text style={{ fontSize: 12, color: tokens.text.muted, letterSpacing: 1 }}>
                {item.accountNumber}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setConfirmDelete(item)}
              accessibilityRole="button"
              accessibilityLabel={t("beneficiaries.deleteAria", "Remove beneficiary")}
              hitSlop={8}
              disabled={deletingId === item.id}
              style={{ padding: 6, marginLeft: 4 }}
            >
              {deletingId === item.id ? (
                <ActivityIndicator size="small" color={tokens.status.error} />
              ) : (
                <Ionicons name="trash-outline" size={18} color={tokens.status.error} />
              )}
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          isLoading ? (
            <View style={{ padding: 40, alignItems: "center" }}>
              <ActivityIndicator color={tokens.brand.default} />
            </View>
          ) : (
            <View style={{ padding: 40, alignItems: "center" }}>
              <Ionicons name="people-outline" size={40} color={tokens.text.muted} />
              <Text style={{ marginTop: 12, fontSize: 14, color: tokens.text.muted, textAlign: "center" }}>
                {t("beneficiaries.emptyTitle", "No saved accounts")}
              </Text>
              <Text style={{ marginTop: 4, fontSize: 12, color: tokens.text.placeholder, textAlign: "center", paddingHorizontal: 28 }}>
                {t("beneficiaries.emptySub", "Banks you withdraw to are saved here for one-tap access.")}
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate("Withdraw")}
                accessibilityRole="button"
                accessibilityLabel={t("beneficiaries.startWithdraw", "Start a withdrawal")}
                style={{
                  marginTop: 18, paddingHorizontal: 18, paddingVertical: 12,
                  backgroundColor: tokens.brand.default, borderRadius: 12,
                }}
              >
                <Text style={{ color: tokens.text.onBrand, fontWeight: "800", fontSize: 13 }}>
                  {t("beneficiaries.startWithdraw", "Start a withdrawal")}
                </Text>
              </TouchableOpacity>
            </View>
          )
        }
      />

      <Modal
        visible={!!confirmDelete}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmDelete(null)}
      >
        <View style={{ flex: 1, backgroundColor: tokens.overlay.scrim, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <View style={{ width: "100%", maxWidth: 360, backgroundColor: tokens.bg.surface, borderRadius: 16, padding: 20 }}>
            <Text accessibilityRole="header" style={{ fontSize: 17, fontWeight: "800", color: tokens.text.primary, marginBottom: 6 }}>
              {t("beneficiaries.confirmTitle", "Remove this beneficiary?")}
            </Text>
            <Text style={{ fontSize: 13, color: tokens.text.muted, marginBottom: 16 }}>
              {t("beneficiaries.confirmBody", "You can add them back any time you withdraw to this account.")}
            </Text>
            {confirmDelete ? (
              <View style={{ backgroundColor: tokens.bg.surfaceMuted, borderRadius: 10, padding: 12, marginBottom: 16 }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: tokens.text.primary }}>
                  {confirmDelete.accountName || confirmDelete.name}
                </Text>
                <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 2 }}>
                  {confirmDelete.bankName || confirmDelete.bankCode} · {confirmDelete.accountNumber}
                </Text>
              </View>
            ) : null}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() => setConfirmDelete(null)}
                accessibilityRole="button"
                accessibilityLabel={t("common.cancel", "Cancel")}
                style={{
                  flex: 1, paddingVertical: 13, borderRadius: 12,
                  backgroundColor: tokens.bg.surfaceMuted, alignItems: "center",
                }}
              >
                <Text style={{ color: tokens.text.primary, fontWeight: "700", fontSize: 14 }}>
                  {t("common.cancel", "Cancel")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDelete(confirmDelete.id)}
                accessibilityRole="button"
                accessibilityLabel={t("beneficiaries.remove", "Remove")}
                style={{
                  flex: 1, paddingVertical: 13, borderRadius: 12,
                  backgroundColor: tokens.status.error, alignItems: "center",
                }}
              >
                <Text style={{ color: tokens.text.onBrand, fontWeight: "800", fontSize: 14 }}>
                  {t("beneficiaries.remove", "Remove")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
