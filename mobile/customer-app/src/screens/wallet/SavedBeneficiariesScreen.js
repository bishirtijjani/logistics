import React, { useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import {
  fetchBeneficiaries,
  deleteBeneficiary,
} from "../../store/slices/walletSlice";
import { colors } from "../../theme";
import Toast from "react-native-toast-message";
import EmptyState from "../../components/EmptyState";

function initials(name) {
  return (name || "?")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export default function SavedBeneficiariesScreen({ navigation }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { beneficiaries, isLoading } = useSelector((s) => s.wallet);

  useEffect(() => {
    dispatch(fetchBeneficiaries());
  }, [dispatch]);

  // Bank accounts only. Legacy phone (P2P) beneficiaries are no longer usable
  // now that transfers go to bank accounts, so they're filtered out entirely.
  const list = beneficiaries.filter((b) => b.bankCode && b.accountNumber);

  const handleDelete = (b) => {
    Alert.alert(
      t("wallet.beneficiaries.removeTitle"),
      t("wallet.beneficiaries.removeBody", { name: b.name }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("wallet.beneficiaries.removeCta"),
          style: "destructive",
          onPress: async () => {
            const res = await dispatch(deleteBeneficiary(b.id));
            if (deleteBeneficiary.fulfilled.match(res)) {
              Toast.show({ type: "success", text1: t("wallet.beneficiaries.removed") });
            }
          },
        },
      ],
    );
  };

  const handleUse = (b) => {
    navigation.navigate("SendMoney", {
      bankCode: b.bankCode,
      bankName: b.bankName,
      accountNumber: b.accountNumber,
      accountName: b.accountName || b.name,
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <View style={{ height: 4, backgroundColor: colors.primary }} />

      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 }}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.back")}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: "900", color: colors.text, marginLeft: 16, letterSpacing: -0.5 }}>
          {t("wallet.savedBeneficiaries")}
        </Text>
      </View>

      {isLoading && list.length === 0 ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} accessibilityLabel={t("common.loading")} />
      ) : list.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title={t("wallet.beneficiaries.noBankTitle")}
          subtitle={t("wallet.beneficiaries.noBankHint")}
        />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 }}
          renderItem={({ item }) => {
            const title = item.accountName || item.name;
            return (
              <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: 16, padding: 14, marginBottom: 10 }}>
                {/* Avatar */}
                <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primary + "20", alignItems: "center", justifyContent: "center", marginRight: 14 }}>
                  <Text style={{ fontSize: 16, fontWeight: "800", color: colors.primary }}>
                    {initials(title)}
                  </Text>
                </View>

                {/* Info */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }} numberOfLines={1}>
                    {title}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{item.accountNumber}</Text>
                  <Text style={{ fontSize: 11, color: colors.primaryStrong, marginTop: 1 }}>{item.bankName || item.bankCode}</Text>
                </View>

                {/* Actions */}
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => handleUse(item)}
                    accessibilityRole="button"
                    accessibilityLabel={t("wallet.beneficiaries.send")}
                    style={{ backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 }}
                  >
                    <Text style={{ color: colors.white, fontWeight: "700", fontSize: 12 }}>
                      {t("wallet.beneficiaries.send")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(item)}
                    style={{ padding: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={t("wallet.beneficiaries.removeCta")}
                  >
                    <Ionicons name="trash-outline" size={20} color="#DC2626" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
