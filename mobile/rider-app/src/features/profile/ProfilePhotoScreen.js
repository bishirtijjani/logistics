/**
 * ProfilePhotoScreen - pick from camera or library, upload via Cloudinary
 * (kind=profile), persist via `PUT /auth/profile/picture`.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import { useTheme } from "../../theme";
import { pickImage } from "../support/supportUploads";
import { chooseImageSource } from "../../lib/chooseImageSource";
import { uploadToCloudinary } from "../../services/cloudinary";
import { updateProfilePicture, fetchProfile } from "../../store/slices/profileSlice";

export default function ProfilePhotoScreen() {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const profile = useSelector((s) => s.profile?.profile);

  const [localUri, setLocalUri] = useState(null);
  const [saving, setSaving] = useState(false);

  const onPick = (source) => async () => {
    const uri = await pickImage(source);
    if (uri) setLocalUri(uri);
  };

  const onSave = async () => {
    if (!localUri) return;
    setSaving(true);
    try {
      const { secureUrl } = await uploadToCloudinary({
        kind: "profile",
        localUri,
      });
      await dispatch(updateProfilePicture(secureUrl)).unwrap();
      Toast.show({ type: "success", text1: t("photo.saved", "Photo updated"), text2: t("photo.savedSub", "Your profile photo has been saved.") });
      dispatch(fetchProfile()).catch?.(() => {});
      navigation.goBack();
    } catch (err) {
      Toast.show({ type: "error", text1: t("photo.uploadFailed", "Upload failed"), text2: err?.message });
    } finally {
      setSaving(false);
    }
  };

  const currentUrl = localUri || profile?.profilePicture;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <View
        style={{
          flexDirection: "row", alignItems: "center",
          paddingHorizontal: 14, paddingVertical: 12,
          backgroundColor: tokens.bg.surface,
          borderBottomWidth: 1, borderBottomColor: tokens.border.default,
        }}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={22} color={tokens.text.primary} />
        </TouchableOpacity>
        <Text accessibilityRole="header" style={{ marginLeft: 10, fontSize: 17, fontWeight: "800", color: tokens.text.primary }}>
          {t("photo.title", "Profile Photo")}
        </Text>
      </View>

      <View style={{ flex: 1, alignItems: "center", paddingTop: 40, paddingHorizontal: 20 }}>
        <TouchableOpacity
          onPress={() =>
            chooseImageSource(onPick("camera"), onPick("gallery"), {
              title: t("photo.chooseSource", "Choose a source"),
              camera: t("photo.camera", "Camera"),
              gallery: t("photo.library", "Photo Library"),
              cancel: t("photo.cancel", "Cancel"),
            })
          }
          activeOpacity={0.85}
          style={{
            width: 180, height: 180, borderRadius: 90,
            backgroundColor: tokens.bg.surfaceMuted,
            alignItems: "center", justifyContent: "center",
            overflow: "hidden",
            borderWidth: 2, borderColor: tokens.brand.default,
          }}
        >
          {currentUrl ? (
            <Image source={{ uri: currentUrl }} style={{ width: 180, height: 180 }} />
          ) : (
            <Ionicons name="person" size={70} color={tokens.text.muted} />
          )}
        </TouchableOpacity>

        <Text style={{ fontSize: 13, color: tokens.text.muted, marginTop: 14 }}>
          {t("photo.tapToChange", "Tap the photo to change it")}
        </Text>

        {localUri ? (
          <TouchableOpacity
            onPress={onSave}
            disabled={saving}
            style={{
              marginTop: 24, paddingHorizontal: 28, paddingVertical: 14,
              borderRadius: 14, backgroundColor: tokens.brand.default,
              minWidth: 160, alignItems: "center",
            }}
          >
            {saving ? (
              <ActivityIndicator color={tokens.text.onBrand} />
            ) : (
              <Text style={{ color: tokens.text.onBrand, fontWeight: "800" }}>
                {t("photo.savePhoto", "Save Photo")}
              </Text>
            )}
          </TouchableOpacity>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
