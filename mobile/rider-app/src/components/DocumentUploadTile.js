import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import Toast from "react-native-toast-message";
import { useTheme } from "../theme";
import { uploadToCloudinary } from "../services/cloudinary";
import { chooseImageSource } from "../lib/chooseImageSource";

/**
 * Single document upload tile.
 *
 * Props:
 *  - title:        string — visible label, e.g. "Driver's licence"
 *  - description?: string — small caption under the title
 *  - kind:         string — upload kind passed to `/auth/upload-signature`
 *  - secureUrl?:   string — current persisted URL (if already uploaded)
 *  - onUploaded:   (secureUrl, publicId) => void
 *  - onCleared?:   () => void
 *  - required?:    boolean
 *  - disabled?:    boolean
 */
export default function DocumentUploadTile({
  title,
  description,
  kind,
  secureUrl,
  onUploaded,
  onCleared,
  required,
  disabled,
}) {
  const { tokens } = useTheme();
  const [busy, setBusy] = useState(false);
  const [localPreviewUri, setLocalPreviewUri] = useState(null);

  // Track mount status + own AbortController so an in-flight upload that
  // outlives the screen doesn't trigger a "setState on unmounted component"
  // warning or finish silently in the background after the user navigates away.
  const isMountedRef = useRef(true);
  const abortRef = useRef(null);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      try { abortRef.current?.abort(); } catch (_) {}
    };
  }, []);
  const setSafely = (setter, value) => {
    if (isMountedRef.current) setter(value);
  };

  const pickAndUpload = async (source) => {
    if (busy || disabled) return;

    // On web the browser file dialog covers permission + source; skipping the
    // awaited permission keeps the dialog inside the user gesture. On native,
    // request the right permission for the chosen source first.
    if (Platform.OS !== "web") {
      const perm =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Toast.show({
          type: "error",
          text1: "Permission denied",
          text2:
            source === "camera"
              ? "Camera access is required to capture documents."
              : "Photo library access is required to choose a document.",
        });
        return;
      }
    }

    const useCamera = source === "camera" && Platform.OS !== "web";
    const result = useCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.9,
          allowsEditing: false,
          exif: false,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.9,
          allowsEditing: false,
          exif: false,
        });

    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.uri) return;

    setBusy(true);
    setLocalPreviewUri(asset.uri);

    // Fresh abort controller per upload attempt; passed through to fetch in
    // cloudinary.js so unmount cancels the network call.
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const compressed = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 1600 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
      );
      if (controller.signal.aborted) return;
      const { secureUrl: url, publicId } = await uploadToCloudinary({
        kind,
        localUri: compressed.uri,
        mimeType: "image/jpeg",
        signal: controller.signal,
      });
      if (controller.signal.aborted || !isMountedRef.current) return;
      onUploaded?.(url, publicId);
      Toast.show({ type: "success", text1: "Uploaded" });
    } catch (err) {
      if (controller.signal.aborted) return; // user navigated away mid-upload
      setSafely(setLocalPreviewUri, null);
      Toast.show({
        type: "error",
        text1: "Upload failed",
        text2: err?.message || "Try again",
      });
    } finally {
      setSafely(setBusy, false);
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const promptSource = () => {
    chooseImageSource(
      () => pickAndUpload("camera"),
      () => pickAndUpload("gallery"),
      {
        title,
        message: "Where would you like to get the image from?",
        camera: "Take photo",
        gallery: "Choose from gallery",
        cancel: "Cancel",
      },
    );
  };

  const hasImage = Boolean(secureUrl || localPreviewUri);
  const previewSrc = secureUrl || localPreviewUri;

  return (
    <View
      style={{
        borderRadius: 14,
        borderWidth: 1,
        borderColor: hasImage ? tokens.brand.softBorder : tokens.border.default,
        backgroundColor: tokens.bg.surface,
        padding: 14,
        marginBottom: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: description ? 4 : 12 }}>
        <Text style={{ flex: 1, fontSize: 15, fontWeight: "700", color: tokens.text.primary }}>
          {title}
          {required ? <Text style={{ color: tokens.status.errorStrong }}> *</Text> : null}
        </Text>
        {hasImage ? (
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="checkmark-circle" size={18} color={tokens.status.success} />
            <Text style={{ marginLeft: 4, fontSize: 12, color: tokens.status.successStrong, fontWeight: "700" }}>
              Uploaded
            </Text>
          </View>
        ) : null}
      </View>

      {description ? (
        <Text style={{ fontSize: 13, color: tokens.text.muted, marginBottom: 12, lineHeight: 18 }}>
          {description}
        </Text>
      ) : null}

      {hasImage ? (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Image
            source={{ uri: previewSrc }}
            style={{
              width: 64,
              height: 64,
              borderRadius: 10,
              backgroundColor: tokens.bg.surfaceMuted,
            }}
          />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <TouchableOpacity
              onPress={promptSource}
              disabled={busy || disabled}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: tokens.border.default,
                alignSelf: "flex-start",
                marginBottom: 6,
              }}
            >
              <Text style={{ fontSize: 13, color: tokens.text.primary, fontWeight: "600" }}>
                {busy ? "Replacing…" : "Replace"}
              </Text>
            </TouchableOpacity>
            {onCleared ? (
              <TouchableOpacity
                onPress={() => {
                  setLocalPreviewUri(null);
                  onCleared?.();
                }}
                disabled={busy || disabled}
              >
                <Text style={{ fontSize: 12, color: tokens.status.errorStrong, fontWeight: "600" }}>
                  Remove
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ) : (
        <TouchableOpacity
          onPress={promptSource}
          disabled={busy || disabled}
          accessibilityRole="button"
          style={{
            paddingVertical: 16,
            borderRadius: 12,
            borderWidth: 1.5,
            borderStyle: "dashed",
            borderColor: tokens.border.strong,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {busy ? (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <ActivityIndicator color={tokens.brand.default} size="small" />
              <Text style={{ marginLeft: 8, fontSize: 13, color: tokens.text.muted, fontWeight: "600" }}>
                Uploading…
              </Text>
            </View>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="cloud-upload-outline" size={18} color={tokens.brand.default} />
              <Text style={{ marginLeft: 8, fontSize: 14, color: tokens.brand.default, fontWeight: "700" }}>
                Upload photo
              </Text>
            </View>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}
