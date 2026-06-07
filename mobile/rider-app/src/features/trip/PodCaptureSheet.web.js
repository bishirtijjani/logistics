import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
 * Web counterpart of PodCaptureSheet.
 *
 * expo-camera's CameraView is unreliable across browsers, so on web we use a
 * native file input with `capture="environment"` — on a mobile browser that
 * opens the rear camera directly; on desktop it opens the file chooser. The
 * picked file becomes an object URL, previewed and uploaded via uploadPodAsset
 * (whose web path turns the URL into a Blob). Same props / Redux actions /
 * onContinue contract as the native sheet. Metro resolves this only on web.
 */
export default function PodCaptureSheet({ visible, onClose, onContinue, requestId }) {
  const { tokens } = useTheme();
  const { t } = useT();
  const dispatch = useDispatch();
  const photoLocalUri = useSelector((s) => s.trip.pod?.photoLocalUri);
  const photoUrl = useSelector((s) => s.trip.pod?.photoUrl);
  const photoUploading = useSelector((s) => s.trip.pod?.photoUploading);
  const photoError = useSelector((s) => s.trip.pod?.photoError);

  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      try { abortRef.current?.abort(); } catch (_) {}
    };
  }, []);

  const openPicker = () => {
    try { inputRef.current?.click(); } catch (_) {}
  };

  const onFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ""; // allow re-picking the same file later
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    dispatch(podPhotoCaptured({ localUri: objectUrl }));
  };

  const retake = () => {
    dispatch(podPhotoCaptured({ localUri: null }));
    openPicker();
  };

  const submit = async () => {
    if (!photoLocalUri || !requestId) return;
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
            <Text accessibilityRole="header" style={{ marginLeft: 10, fontWeight: "800", color: "#fff", fontSize: 16, flex: 1 }}>
              {t("pod.capture.title", "Proof of delivery")}
            </Text>
          </View>
        </SafeAreaView>

        {/* Hidden DOM file input. `capture="environment"` opens the rear camera
            on mobile browsers; desktop falls back to a file chooser. */}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onFileChange}
          style={{ display: "none" }}
        />

        {photoLocalUri ? (
          <View style={{ flex: 1, backgroundColor: "#000" }}>
            <Image
              source={{ uri: photoLocalUri }}
              style={{ flex: 1, width: "100%", resizeMode: "contain" }}
              accessibilityLabel={t("pod.capture.previewAria", "Captured doorstep photo")}
            />
            {photoUploading ? (
              <View style={{ position: "absolute", left: 0, right: 0, top: "40%", alignItems: "center" }}>
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
                    flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center",
                    backgroundColor: "rgba(255,255,255,0.15)", opacity: photoUploading ? 0.5 : 1,
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
                    flex: 2, paddingVertical: 14, borderRadius: 12, alignItems: "center",
                    backgroundColor: photoUploading ? tokens.border.strong : tokens.brand.default,
                  }}
                >
                  <Text style={{ color: tokens.text.onBrand, fontWeight: "800", fontSize: 14 }}>
                    {photoUploading ? t("pod.capture.uploading", "Uploading…") : t("pod.capture.continue", "Continue")}
                  </Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </View>
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
            <Ionicons name="camera-outline" size={64} color="rgba(255,255,255,0.7)" />
            <Text style={{ color: "#fff", fontSize: 17, fontWeight: "800", marginTop: 16, textAlign: "center" }}>
              {t("pod.capture.title", "Proof of delivery")}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, marginTop: 8, textAlign: "center", lineHeight: 20 }}>
              {t("pod.capture.webHint", "Take a photo of the package at the doorstep, or choose one from your device.")}
            </Text>
            <TouchableOpacity
              onPress={openPicker}
              accessibilityRole="button"
              accessibilityLabel={t("pod.capture.webTakePhoto", "Take or choose photo")}
              style={{ marginTop: 22, paddingHorizontal: 22, paddingVertical: 13, borderRadius: 12, backgroundColor: tokens.brand.default }}
            >
              <Text style={{ color: tokens.text.onBrand, fontWeight: "800", fontSize: 14 }}>
                {t("pod.capture.webTakePhoto", "Take / choose photo")}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}
