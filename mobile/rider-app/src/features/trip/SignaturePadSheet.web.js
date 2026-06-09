import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
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
  podSignatureCaptured,
  podSignatureUploading,
  podSignatureUploaded,
  podSignatureUploadFailed,
} from "../../store/slices/tripSlice";
import { uploadPodAsset } from "../../services/cloudinary";

/**
 * Web counterpart of SignaturePadSheet.
 *
 * The native sheet uses react-native-signature-canvas (a WebView) and writes the
 * PNG to expo-file-system before upload - neither works in a browser. This
 * version draws on a plain HTML <canvas> (pointer events cover mouse + touch),
 * exports a PNG data URL, and hands it straight to uploadPodAsset, which now
 * accepts a data/blob URL on web (see services/cloudinary.js). It keeps the exact
 * same props, Redux actions, and onContinue contract as the native sheet, so
 * TripCockpitScreen renders it identically. Metro resolves this file only on web.
 */
export default function SignaturePadSheet({ visible, onClose, onContinue, requestId }) {
  const { tokens } = useTheme();
  const { t } = useT();
  const dispatch = useDispatch();
  const signatureUrl = useSelector((s) => s.trip.pod?.signatureUrl);
  const signatureUploading = useSelector((s) => s.trip.pod?.signatureUploading);
  const signatureError = useSelector((s) => s.trip.pod?.signatureError);

  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const hasDrawn = useRef(false);
  const last = useRef(null);
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

  // (Re)initialise the canvas each time the sheet opens: size it to its box and
  // paint a white background so the exported PNG isn't transparent-on-nothing.
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width));
    canvas.height = Math.max(1, Math.floor(rect.height));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = tokens.text.primary;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    hasDrawn.current = false;
  }, [tokens.text.primary]);

  useEffect(() => {
    if (visible) {
      // Defer to next frame so the modal/canvas has laid out before we measure.
      const id = requestAnimationFrame(initCanvas);
      return () => cancelAnimationFrame(id);
    }
  }, [visible, initCanvas]);

  const pointFromEvent = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e) => {
    e.preventDefault();
    drawing.current = true;
    hasDrawn.current = true;
    last.current = pointFromEvent(e);
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch (_) {}
  };

  const onPointerMove = (e) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current.getContext("2d");
    const p = pointFromEvent(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };

  const onPointerUp = () => {
    drawing.current = false;
    last.current = null;
  };

  const handleClear = () => {
    initCanvas();
    dispatch(podSignatureCaptured({ localUri: null }));
  };

  const submit = async (dataUrl) => {
    if (!dataUrl || !requestId) return;
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
        localUri: dataUrl,
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

  const handleDone = async () => {
    if (!hasDrawn.current) {
      Toast.show({
        type: "info",
        text1: t("pod.signature.empty", "No signature drawn"),
        text2: t("pod.signature.emptySub", "Have them sign first, then tap Done."),
      });
      return;
    }
    setExporting(true);
    try {
      const dataUrl = canvasRef.current.toDataURL("image/png");
      dispatch(podSignatureCaptured({ localUri: dataUrl }));
      await submit(dataUrl);
    } catch (err) {
      Toast.show({
        type: "error",
        text1: t("pod.signature.failed", "Couldn't save signature"),
        text2: err?.message || t("pod.signature.failedFallback", "Try again."),
      });
    } finally {
      if (isMountedRef.current) setExporting(false);
    }
  };

  const busy = signatureUploading || exporting;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
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

        <View style={{ flex: 1, paddingHorizontal: 14, paddingBottom: 14 }}>
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            style={{
              width: "100%",
              height: "100%",
              touchAction: "none",
              borderRadius: 12,
              border: `2px dashed ${tokens.border.strong}`,
              backgroundColor: "#ffffff",
            }}
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
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={t("pod.signature.clearAria", "Clear signature")}
              style={{
                flex: 1, paddingVertical: 14, borderRadius: 12,
                alignItems: "center",
                backgroundColor: tokens.bg.surfaceMuted,
                borderWidth: 1, borderColor: tokens.border.default,
                opacity: busy ? 0.5 : 1,
              }}
            >
              <Text style={{ color: tokens.text.primary, fontWeight: "700", fontSize: 14 }}>
                {t("pod.signature.clear", "Clear")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleDone}
              disabled={busy}
              accessibilityRole="button"
              accessibilityState={{ disabled: busy, busy }}
              accessibilityLabel={t("pod.signature.doneAria", "Save signature")}
              style={{
                flex: 2, paddingVertical: 14, borderRadius: 12,
                alignItems: "center", justifyContent: "center",
                backgroundColor: busy ? tokens.border.strong : tokens.brand.default,
              }}
            >
              {busy ? (
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
