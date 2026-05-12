import React, { useEffect, useState } from "react";
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
  const [tab, setTab] = useState("phone"); // phone | bank

  useEffect(() => {
    dispatch(fetchBeneficiaries());
  }, [dispatch]);

  const phoneBeneficiaries = beneficiaries.filter((b) => b.phone);
  const bankBeneficiaries = beneficiaries.filter((b) => b.bankCode);
  const list = tab === "phone" ? phoneBeneficiaries : bankBeneficiaries;

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
    if (tab === "phone") {
      navigation.navigate("SendMoney", { prefillPhone: b.phone, prefillName: b.name });
    } else {
      navigation.navigate("Withdraw", {
        prefillBank: { bankCode: b.bankCode, bankName: b.bankCode },
        prefillAccount: b.accountNumber,
        prefillName: b.accountName || b.name,
      });
    }
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

      {/* Tabs */}
      <View style={{ flexDirection: "row", paddingHorizontal: 20, marginTop: 16, marginBottom: 8 }} accessibilityRole="tablist">
        {["phone", "bank"].map((tabKey) => {
          const selected = tab === tabKey;
          const label = tabKey === "phone"
            ? t("wallet.beneficiaries.tabPhone")
            : t("wallet.beneficiaries.tabBank");
          return (
            <TouchableOpacity
              key={tabKey}
              onPress={() => setTab(tabKey)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={label}
              style={{
                flex: 1,
                paddingVertical: 10,
                alignItems: "center",
                borderRadius: 10,
                backgroundColor: selected ? colors.primary : colors.surface,
                marginRight: tabKey === "phone" ? 8 : 0,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: selected ? colors.white : colors.textMuted }}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {isLoading && list.length === 0 ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} accessibilityLabel={t("common.loading")} />
      ) : list.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title={tab === "phone" ? t("wallet.beneficiaries.noPhoneTitle") : t("wallet.beneficiaries.noBankTitle")}
          subtitle={tab === "phone" ? t("wallet.beneficiaries.noPhoneHint") : t("wallet.beneficiaries.noBankHint")}
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
                  {tab === "phone" ? (
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{item.phone}</Text>
                  ) : (
                    <>
                      <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{item.accountNumber}</Text>
                      <Text style={{ fontSize: 11, color: colors.primary, marginTop: 1 }}>{item.bankCode}</Text>
                    </>
                  )}
                </View>

                {/* Actions */}
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => handleUse(item)}
                    accessibilityRole="button"
                    accessibilityLabel={tab === "phone" ? t("wallet.beneficiaries.send") : t("wallet.beneficiaries.withdraw")}
                    style={{ backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 }}
                  >
                    <Text style={{ color: colors.white, fontWeight: "700", fontSize: 12 }}>
                      {tab === "phone" ? t("wallet.beneficiaries.send") : t("wallet.beneficiaries.withdraw")}
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
