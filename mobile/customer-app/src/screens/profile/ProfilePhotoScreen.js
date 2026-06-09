import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { appendUploadFile } from "../../lib/uploadFile";
import { chooseImageSource } from "../../lib/chooseImageSource";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import { updateProfilePicture, getUploadSignature } from "../../store/slices/profileSlice";
import { useTheme } from "../../theme";
import api from "../../services/api";

export default function ProfilePhotoScreen({ navigation }) {
  const dispatch = useDispatch();
  const { tokens, isDark } = useTheme();
  const { t } = useTranslation();
  const { profile } = useSelector((state) => state.profile);
  const [localUri, setLocalUri] = useState(null);
  const [uploading, setUploading] = useState(false);

  const currentPhoto = localUri || profile?.profilePicture;
  const initials =
    (profile?.firstName?.[0] || "") + (profile?.lastName?.[0] || "");

  const pickImage = async (source) => {
    let result;

    if (Platform.OS === "web") {
      // Browser file dialog - go straight to it within the click gesture.
      const r = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!r.canceled && r.assets?.[0]) setLocalUri(r.assets[0].uri);
      return;
    }

    if (source === "camera") {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          t("photo.permissionTitle"),
          t("photo.permissionCamera"),
        );
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
    } else {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t("photo.permissionTitle"), t("photo.permissionLibrary"));
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
    }

    if (!result.canceled && result.assets?.[0]) {
      setLocalUri(result.assets[0].uri);
    }
  };

  const showPickerOptions = () => {
    chooseImageSource(
      () => pickImage("camera"),
      () => pickImage("gallery"),
      {
        title: t("photo.title"),
        message: t("photo.chooseSource"),
        camera: t("photo.camera"),
        gallery: t("photo.library"),
        cancel: t("photo.cancel"),
      },
    );
  };

  const uploadToCloudinary = async (uri, signatureData) => {
    // Create form data for upload
    const formData = new FormData();
    
    // Get file info
    const filename = uri.split('/').pop();
    const match = /\.(.+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';
    
    // Append file (cross-platform: Blob on web, RN { uri } descriptor on native).
    await appendUploadFile(formData, uri, { name: filename, type });

    formData.append('api_key', String(signatureData.apiKey));
    formData.append('timestamp', String(signatureData.timestamp));
    formData.append('signature', String(signatureData.signature));
    formData.append('folder', String(signatureData.folder));
    formData.append('public_id', String(signatureData.publicId));

    // Don't set Content-Type manually - fetch must add the multipart boundary.
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${signatureData.cloudName}/image/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Cloudinary upload failed: ${error}`);
    }

    const data = await response.json();
    return data.secure_url;
  };

  const handleSave = async () => {
    if (!localUri) return;
    setUploading(true);

    try {
      // Step 1: Get Cloudinary signature from backend
      const signatureResult = await dispatch(getUploadSignature());
      
      if (!getUploadSignature.fulfilled.match(signatureResult)) {
        throw new Error('Failed to get upload signature');
      }

      const signatureData = signatureResult.payload;

      // Step 2: Upload to Cloudinary
      const cloudinaryUrl = await uploadToCloudinary(localUri, signatureData);

      // Step 3: Save URL to backend
      const result = await dispatch(updateProfilePicture(cloudinaryUrl));

      if (updateProfilePicture.fulfilled.match(result)) {
        Toast.show({
          type: "success",
          text1: t("photo.saved"),
          text2: t("photo.savedSub"),
        });
        navigation.goBack();
      } else {
        throw new Error(result.payload || 'Failed to save profile picture');
      }
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t("photo.uploadFailed"),
        text2: error.message || t("common.retry"),
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: tokens.bg.canvas }}
      edges={["top"]}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={tokens.bg.canvas}
      />
      <View style={{ height: 4, backgroundColor: tokens.brand.default }} />

      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingVertical: 16,
        }}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.back")}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: tokens.bg.surfaceMuted,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 14,
          }}
        >
          <Ionicons name="arrow-back" size={20} color={tokens.text.primary} />
        </TouchableOpacity>
        <Text
          accessibilityRole="header"
          style={{
            fontSize: 20,
            fontWeight: "900",
            color: tokens.text.primary,
            letterSpacing: -0.5,
          }}
        >
          {t("photo.title")}
        </Text>
      </View>

      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 20,
        }}
      >
        {/* Photo Preview */}
        <TouchableOpacity onPress={showPickerOptions} activeOpacity={0.8}>
          {currentPhoto ? (
            <View>
              <Image
                source={{ uri: currentPhoto }}
                style={{
                  width: 180,
                  height: 180,
                  borderRadius: 90,
                  borderWidth: 4,
                  borderColor: tokens.brand.default,
                }}
              />
              <View
                style={{
                  position: "absolute",
                  bottom: 8,
                  right: 8,
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: tokens.brand.default,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 3,
                  borderColor: tokens.bg.canvas,
                }}
              >
                <Ionicons name="camera" size={20} color={tokens.text.onBrand} />
              </View>
            </View>
          ) : (
            <View>
              <View
                style={{
                  width: 180,
                  height: 180,
                  borderRadius: 90,
                  backgroundColor: tokens.bg.elevated,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 4,
                  borderColor: tokens.border.default,
                }}
              >
                <Text
                  style={{
                    color: tokens.text.onElevated,
                    fontSize: 56,
                    fontWeight: "900",
                  }}
                >
                  {initials.toUpperCase() || "?"}
                </Text>
              </View>
              <View
                style={{
                  position: "absolute",
                  bottom: 8,
                  right: 8,
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: tokens.brand.default,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 3,
                  borderColor: tokens.bg.canvas,
                }}
              >
                <Ionicons name="camera" size={20} color={tokens.text.onBrand} />
              </View>
            </View>
          )}
        </TouchableOpacity>

        <Text
          style={{
            fontSize: 14,
            color: tokens.text.muted,
            marginTop: 20,
            textAlign: "center",
          }}
        >
          {t("photo.tapToChange")}
        </Text>

        {/* Action Buttons */}
        <View style={{ width: "100%", marginTop: 40 }}>
          <TouchableOpacity
            style={{
              width: "100%",
              padding: 16,
              borderRadius: 16,
              alignItems: "center",
              backgroundColor:
                !localUri || uploading
                  ? tokens.text.placeholder
                  : tokens.brand.default,
            }}
            onPress={handleSave}
            disabled={!localUri || uploading}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t("photo.savePhoto")}
            accessibilityState={{ disabled: !localUri || uploading, busy: uploading }}
          >
            {uploading ? (
              <ActivityIndicator color={tokens.text.onBrand} />
            ) : (
              <Text
                style={{
                  color: tokens.text.onBrand,
                  fontSize: 15,
                  fontWeight: "800",
                }}
              >
                {t("photo.savePhoto")}
              </Text>
            )}
          </TouchableOpacity>

          {currentPhoto && (
            <TouchableOpacity
              onPress={showPickerOptions}
              style={{
                width: "100%",
                padding: 16,
                borderRadius: 16,
                alignItems: "center",
                marginTop: 10,
                backgroundColor: tokens.bg.surfaceMuted,
                borderWidth: 1.5,
                borderColor: tokens.border.default,
              }}
              activeOpacity={0.8}
            >
              <Text
                style={{
                  color: tokens.text.primary,
                  fontSize: 15,
                  fontWeight: "700",
                }}
              >
                {t("photo.chooseDifferent")}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
