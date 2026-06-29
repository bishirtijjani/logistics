import React, { useRef, useState, useEffect } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as FileSystem from "expo-file-system/legacy";
import { Ionicons } from "@expo/vector-icons";
import SignatureView from "react-native-signature-canvas";
import Toast from "react-native-toast-message";
import { useDispatch, useSelector } from "react-redux";
import { useTheme } from "../../theme";
import { useT } from "../../i18n/useT";
import {
  podSignatureCaptured,
  podSignatureUploading,
  podSignatureUploaded,
  podSignatureUploadFailed,
} from "../../store/slices/tripSlice";
import { uploadPodAsset } from "../../services/cloudinary";

/**
 * SignaturePadSheet - recipient signs on the screen with a finger; we export
 * the signature as a PNG dataURL, stash it to a local file, and upload to
 * Cloudinary into the same `iprime/pod/{requestId}/` folder as the
 * doorstep photo.
 *
 * Only rendered when `delivery.requireSignature` setting is on.
 *
 * The signature canvas itself is a WebView under the hood, which means it
 * doesn't give us a regular file URI - it returns base64 data. We persist
 * the base64-decoded bytes to the cache directory so the cloudinary client
 * can upload it as a normal file.
 */
export default function SignaturePadSheet({ visible, onClose, onContinue, requestId }) {
  const { tokens } = useTheme();
  const { t } = useT();
  const dispatch = useDispatch();
  const signatureUrl = useSelector((s) => s.trip.pod?.signatureUrl);
  const signatureLocalUri = useSelector((s) => s.trip.pod?.signatureLocalUri);
  const signatureUploading = useSelector((s) => s.trip.pod?.signatureUploading);
  const signatureError = useSelector((s) => s.trip.pod?.signatureError);

  const ref = useRef(null);
  const abortRef = useRef(null);
  const isMountedRef = useRef(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      try { abortRef.current?.abort(); } catch (_) {}
    };
  }, []);

  const handleOK = async (signatureDataUrl) => {
    setExporting(true);
    try {
      // SignatureView returns "data:image/png;base64,iVBORw0..." - strip the
      // prefix and write the bytes to a temp file in the cache directory.
      const base64 = String(signatureDataUrl).replace(/^data:image\/\w+;base64,/, "");
      const path = `${FileSystem.cacheDirectory}pod_signature_${requestId}_${Date.now()}.png`;
      await FileSystem.writeAsStringAsync(path, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (!isMountedRef.current) return;
      dispatch(podSignatureCaptured({ localUri: path }));
      // Auto-trigger upload immediately so the rider doesn't get stuck on the
      // "Done" tap if upload is slow.
      await submit(path);
    } catch (err) {
      if (!isMountedRef.current) return;
      Toast.show({
        type: "error",
        text1: t("pod.signature.failed", "Couldn't save signature"),
        text2: err?.message || t("pod.signature.failedFallback", "Try again."),
      });
    } finally {
      if (isMountedRef.current) setExporting(false);
    }
  };

  const submit = async (localUri) => {
    const uri = localUri || signatureLocalUri;
    if (!uri || !requestId) return;
    if (signatureUrl) {
      onContinue?.();
      return;
    }
    dispatch(podSignatureUploading());
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await uploadPodAsset({
        assetKind: "signature",
        localUri: uri,
        requestId,
        signal: controller.signal,
      });
      if (!isMountedRef.current) return;
      dispatch(podSignatureUploaded({ secureUrl: result.secureUrl }));
      onContinue?.();
    } catch (err) {
      if (controller.signal.aborted) return;
      if (!isMountedRef.current) return;
      const msg = err?.message || t("pod.signature.uploadFailedFallback", "Upload failed. Try again.");
      dispatch(podSignatureUploadFailed({ message: msg }));
      Toast.show({
        type: "error",
        text1: t("pod.signature.uploadFailed", "Upload failed"),
        text2: msg,
      });
    } finally {
      abortRef.current = null;
    }
  };

  const handleClear = () => {
    try { ref.current?.clearSignature(); } catch (_) {}
    dispatch(podSignatureCaptured({ localUri: null }));
  };

  // Web-style overrides for the embedded WebView signature canvas.
  const webStyle = `
    .m-signature-pad { box-shadow: none; border: none; }
    .m-signature-pad--body { border: 2px dashed #d1d5db; border-radius: 12px; }
    .m-signature-pad--footer { display: none; }
    body, html { background-color: #ffffff; }
  `;

  // statusBarTranslucent is required on Android: under RN 0.81 edge-to-edge a
  // non-transparent Modal without it mismeasures, so the SafeAreaView below
  // collapses and the user sees only a dim, frozen screen.
  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
        {/* Header */}
        <View
          style={{
            flexDirection: "row", alignItems: "center",
            paddingHorizontal: 14, paddingVertical: 10,
            borderBottomWidth: 1, borderBottomColor: tokens.border.default,
            backgroundColor: tokens.bg.surface,
          }}
        >
          <TouchableOpacity
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t("pod.signature.close", "Close")}
            hitSlop={8}
            style={{ padding: 6 }}
          >
            <Ionicons name="close" size={24} color={tokens.text.primary} />
          </TouchableOpacity>
          <Text
            accessibilityRole="header"
            style={{ marginLeft: 10, fontWeight: "800", color: tokens.text.primary, fontSize: 16, flex: 1 }}
          >
            {t("pod.signature.title", "Recipient signature")}
          </Text>
        </View>

        <Text style={{ paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, color: tokens.text.muted }}>
          {t("pod.signature.hint", "Ask the recipient to sign with their finger.")}
        </Text>

        <View style={{ flex: 1, paddingHorizontal: 14 }}>
          <SignatureView
            ref={ref}
            onOK={handleOK}
            onEmpty={() => Toast.show({
              type: "info",
              text1: t("pod.signature.empty", "No signature drawn"),
              text2: t("pod.signature.emptySub", "Have them sign first, then tap Done."),
            })}
            descriptionText=""
            imageType="image/png"
            trimWhitespace
            backgroundColor="#ffffff"
            penColor={tokens.text.primary}
            webStyle={webStyle}
            androidLayerType={Platform.OS === "android" ? "hardware" : undefined}
            style={{ flex: 1 }}
          />
        </View>

        {signatureError ? (
          <Text style={{ color: tokens.status.errorStrong, paddingHorizontal: 14, paddingVertical: 6, fontSize: 13 }}>
            {signatureError}
          </Text>
        ) : null}

        <SafeAreaView edges={["bottom"]} style={{ backgroundColor: tokens.bg.surface, borderTopWidth: 1, borderTopColor: tokens.border.default }}>
          <View style={{ flexDirection: "row", padding: 14, gap: 10 }}>
            <TouchableOpacity
              onPress={handleClear}
              disabled={signatureUploading || exporting}
              accessibilityRole="button"
              accessibilityLabel={t("pod.signature.clearAria", "Clear signature")}
              style={{
                flex: 1, paddingVertical: 14, borderRadius: 12,
                alignItems: "center",
                backgroundColor: tokens.bg.surfaceMuted,
                borderWidth: 1, borderColor: tokens.border.default,
                opacity: (signatureUploading || exporting) ? 0.5 : 1,
              }}
            >
              <Text style={{ color: tokens.text.primary, fontWeight: "700", fontSize: 14 }}>
                {t("pod.signature.clear", "Clear")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => ref.current?.readSignature()}
              disabled={signatureUploading || exporting}
              accessibilityRole="button"
              accessibilityState={{ disabled: signatureUploading || exporting, busy: signatureUploading || exporting }}
              accessibilityLabel={t("pod.signature.doneAria", "Save signature")}
              style={{
                flex: 2, paddingVertical: 14, borderRadius: 12,
                alignItems: "center", justifyContent: "center",
                backgroundColor: (signatureUploading || exporting) ? tokens.border.strong : tokens.brand.default,
              }}
            >
              {(signatureUploading || exporting) ? (
                <ActivityIndicator color={tokens.text.onBrand} />
              ) : (
                <Text style={{ color: tokens.text.onBrand, fontWeight: "800", fontSize: 14 }}>
                  {t("pod.signature.done", "Done")}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </SafeAreaView>
    </Modal>
  );
}
