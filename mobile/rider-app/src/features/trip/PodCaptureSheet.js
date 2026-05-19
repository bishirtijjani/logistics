import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { useDispatch, useSelector } from "react-redux";
import { useTheme } from "../../theme";
import { useT } from "../../i18n/useT";
import {
  podPhotoCaptured,
  podPhotoUploading,
  podPhotoUploaded,
  podPhotoUploadFailed,
} from "../../store/slices/tripSlice";
import { uploadPodAsset } from "../../services/cloudinary";

/**
 * PodCaptureSheet — full-screen camera for the doorstep photo.
 *
 * Flow:
 *   1. Mount → request CAMERA permission via `expo-camera`.
 *   2. Render `CameraView` (rear-facing) with shutter button.
 *   3. On shutter: take picture → compress (JPEG q=0.7, long-edge ≤ 1600 px,
 *      target ≤ 1 MB) → preview with Retake / Continue.
 *   4. On Continue: kick off Cloudinary upload (retries with backoff inside
 *      `uploadPodAsset`). Upload result lands on `tripSlice.pod.photoUrl`.
 *   5. On success → `onContinue()` (parent moves to next sheet / submit).
 *
 * The captured local URI is persisted to SecureStore via the slice draft so
 * a kill+restart restores the preview.
 */
export default function PodCaptureSheet({ visible, onClose, onContinue, requestId }) {
  const { tokens } = useTheme();
  const { t } = useT();
  const dispatch = useDispatch();
  const photoLocalUri = useSelector((s) => s.trip.pod?.photoLocalUri);
  const photoUrl = useSelector((s) => s.trip.pod?.photoUrl);
  const photoUploading = useSelector((s) => s.trip.pod?.photoUploading);
  const photoError = useSelector((s) => s.trip.pod?.photoError);

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const abortRef = useRef(null);
  const isMountedRef = useRef(true);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Abort any in-flight upload — the camera sheet is going away.
      try { abortRef.current?.abort(); } catch (_) {}
    };
  }, []);

  // Request permission lazily on first open. If already granted, no prompt.
  useEffect(() => {
    if (visible && permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [visible, permission, requestPermission]);

  const compress = async (uri) => {
    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1600 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
      );
      return manipulated.uri;
    } catch (_) {
      // Fall back to the original if the manipulator failed (e.g. emulator).
      return uri;
    }
  };

  const takePicture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: false,
        // Don't include base64 — it bloats memory and we re-encode below.
      });
      if (!isMountedRef.current) return;
      const compressedUri = await compress(photo.uri);
      if (!isMountedRef.current) return;
      dispatch(podPhotoCaptured({ localUri: compressedUri }));
    } catch (err) {
      Toast.show({
        type: "error",
        text1: t("pod.capture.failed", "Couldn't take the photo"),
        text2: err?.message || t("pod.capture.failedFallback", "Try again."),
      });
    } finally {
      if (isMountedRef.current) setCapturing(false);
    }
  };

  const retake = () => {
    dispatch(podPhotoCaptured({ localUri: null }));
  };

  const submit = async () => {
    if (!photoLocalUri || !requestId) return;
    // If we already have a URL from a prior upload, skip and continue.
    if (photoUrl) {
      onContinue?.();
      return;
    }
    dispatch(podPhotoUploading());
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await uploadPodAsset({
        assetKind: "photo",
        localUri: photoLocalUri,
        requestId,
        signal: controller.signal,
      });
      if (!isMountedRef.current) return;
      dispatch(podPhotoUploaded({ secureUrl: result.secureUrl }));
      onContinue?.();
    } catch (err) {
      if (controller.signal.aborted) return;
      if (!isMountedRef.current) return;
      const msg = err?.message || t("pod.capture.uploadFailedFallback", "Upload failed — try again.");
      dispatch(podPhotoUploadFailed({ message: msg }));
      Toast.show({ type: "error", text1: t("pod.capture.uploadFailed", "Upload failed"), text2: msg });
    } finally {
      abortRef.current = null;
    }
  };

  // ── Render branches ─────────────────────────────────────────────────────

  const renderPermissionScreen = () => {
    // OS-revoked permission with "Don't ask again" — system prompt won't show.
    // Send the user to Settings instead so they can manually re-grant.
    const blocked = !permission?.canAskAgain;
    const onPrimary = blocked
      ? () => Linking.openSettings().catch(() => {})
      : requestPermission;
    const primaryLabel = blocked
      ? t("pod.capture.permOpenSettings", "Open Settings")
      : t("pod.capture.permGrant", "Grant access");
    const bodyText = blocked
      ? t("pod.capture.permBlockedBody", "Camera access is off for this app. Enable it in Settings to continue.")
      : t("pod.capture.permBody", "The doorstep photo proves the delivery happened. Grant camera access to continue.");
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
        <Ionicons name="camera-outline" size={64} color={tokens.text.muted} />
        <Text accessibilityRole="header" style={{ fontSize: 18, fontWeight: "800", color: tokens.text.primary, marginTop: 16, textAlign: "center" }}>
          {t("pod.capture.permTitle", "Camera permission needed")}
        </Text>
        <Text style={{ fontSize: 14, color: tokens.text.muted, marginTop: 8, textAlign: "center" }}>
          {bodyText}
        </Text>
        <TouchableOpacity
          onPress={onPrimary}
          accessibilityRole="button"
          accessibilityLabel={primaryLabel}
          style={{
            marginTop: 22, paddingHorizontal: 22, paddingVertical: 13,
            borderRadius: 12, backgroundColor: tokens.brand.default,
          }}
        >
          <Text style={{ color: tokens.text.onBrand, fontWeight: "800", fontSize: 14 }}>
            {primaryLabel}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel={t("pod.capture.permCancel", "Cancel")} style={{ marginTop: 14, padding: 8 }}>
          <Text style={{ color: tokens.text.muted, fontWeight: "600" }}>{t("pod.capture.permCancel", "Cancel")}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderPreview = () => (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <Image
        source={{ uri: photoLocalUri }}
        style={{ flex: 1, width: "100%", resizeMode: "contain" }}
        accessibilityLabel={t("pod.capture.previewAria", "Captured doorstep photo")}
      />
      {photoUploading ? (
        <View
          style={{
            position: "absolute", left: 0, right: 0, top: "40%",
            alignItems: "center",
          }}
        >
          <View style={{ backgroundColor: "rgba(0,0,0,0.7)", padding: 16, borderRadius: 12, alignItems: "center" }}>
            <ActivityIndicator color="#fff" />
            <Text style={{ color: "#fff", marginTop: 8, fontWeight: "700" }}>
              {t("pod.capture.uploading", "Uploading…")}
            </Text>
          </View>
        </View>
      ) : null}
      <SafeAreaView edges={["bottom"]} style={{ backgroundColor: "rgba(0,0,0,0.85)" }}>
        {photoError ? (
          <Text style={{ color: "#FCA5A5", textAlign: "center", padding: 10, fontSize: 13 }}>
            {photoError}
          </Text>
        ) : null}
        <View style={{ flexDirection: "row", padding: 14, gap: 10 }}>
          <TouchableOpacity
            onPress={retake}
            disabled={photoUploading}
            accessibilityRole="button"
            accessibilityLabel={t("pod.capture.retakeAria", "Retake photo")}
            style={{
              flex: 1, paddingVertical: 14, borderRadius: 12,
              alignItems: "center",
              backgroundColor: "rgba(255,255,255,0.15)",
              opacity: photoUploading ? 0.5 : 1,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>
              {t("pod.capture.retake", "Retake")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={submit}
            disabled={photoUploading}
            accessibilityRole="button"
            accessibilityState={{ disabled: photoUploading, busy: photoUploading }}
            accessibilityLabel={t("pod.capture.continueAria", "Upload and continue")}
            style={{
              flex: 2, paddingVertical: 14, borderRadius: 12,
              alignItems: "center",
              backgroundColor: photoUploading ? tokens.border.strong : tokens.brand.default,
            }}
          >
            <Text style={{ color: tokens.text.onBrand, fontWeight: "800", fontSize: 14 }}>
              {photoUploading
                ? t("pod.capture.uploading", "Uploading…")
                : t("pod.capture.continue", "Continue")}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );

  const renderCamera = () => (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <CameraView
        ref={cameraRef}
        style={{ flex: 1 }}
        facing="back"
        // No mute prop in expo-camera v15+; flash defaults to off.
      />
      <SafeAreaView edges={["bottom"]} style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
        <Text style={{ color: "#fff", textAlign: "center", paddingTop: 12, fontSize: 13, fontWeight: "600" }}>
          {t("pod.capture.hint", "Frame the package at the doorstep.")}
        </Text>
        <View style={{ alignItems: "center", paddingVertical: 18 }}>
          <TouchableOpacity
            onPress={takePicture}
            disabled={capturing}
            accessibilityRole="button"
            accessibilityState={{ disabled: capturing, busy: capturing }}
            accessibilityLabel={t("pod.capture.shutter", "Take photo")}
            style={{
              width: 78, height: 78, borderRadius: 39,
              backgroundColor: "#fff",
              borderWidth: 5, borderColor: "rgba(255,255,255,0.4)",
              alignItems: "center", justifyContent: "center",
              opacity: capturing ? 0.6 : 1,
            }}
          >
            {capturing ? (
              <ActivityIndicator color={tokens.brand.default} />
            ) : (
              <View
                style={{
                  width: 62, height: 62, borderRadius: 31,
                  backgroundColor: "#fff",
                  borderWidth: 1, borderColor: "#D1D5DB",
                }}
              />
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <SafeAreaView edges={["top"]} style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10 }}>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t("pod.capture.close", "Close")}
              hitSlop={8}
              style={{ padding: 6 }}
            >
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
            <Text
              accessibilityRole="header"
              style={{ marginLeft: 10, fontWeight: "800", color: "#fff", fontSize: 16, flex: 1 }}
            >
              {t("pod.capture.title", "Proof of delivery")}
            </Text>
          </View>
        </SafeAreaView>

        {!permission
          ? <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator color="#fff" />
            </View>
          : !permission.granted
            ? renderPermissionScreen()
            : photoLocalUri
              ? renderPreview()
              : renderCamera()}
      </View>
    </Modal>
  );
}
