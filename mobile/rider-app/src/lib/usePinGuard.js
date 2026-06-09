import { useCallback } from "react";
import { Alert } from "react-native";
import { useSelector } from "react-redux";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

/**
 * Guard for any action that requires a transaction PIN. Use BEFORE opening
 * the PIN keypad so users without a PIN never see a useless keypad.
 *
 *   const requirePin = usePinGuard();
 *   const onPay = () => {
 *     if (!requirePin()) return;        // shows alert + routes to SetPin
 *     setShowPinSheet(true);
 *   };
 *
 * If the profile slice hasn't hydrated yet we assume the PIN exists - the
 * server's PIN_NOT_SET response is the backstop, and the per-screen catch
 * handlers route to SetPin if it fires.
 */
export function usePinGuard() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const hasPinSet = useSelector((s) => s.profile?.profile?.hasPinSet);

  return useCallback(() => {
    if (hasPinSet === undefined || hasPinSet === null) return true;
    if (hasPinSet) return true;
    Alert.alert(
      t("pinGuard.title"),
      t("pinGuard.body"),
      [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("pinGuard.cta"), onPress: () => navigation.navigate("SetPin") },
      ],
    );
    return false;
  }, [hasPinSet, navigation, t]);
}
