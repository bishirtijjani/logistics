import { toPng } from "html-to-image";

/**
 * Web counterpart to react-native-view-shot + expo-sharing (neither functions in
 * a browser). Rasterises a DOM node (located by its nativeID/id) to a PNG, then
 * shares it via the Web Share API when available (mobile browsers) or falls back
 * to a file download (desktop). Only called behind a Platform.OS === 'web' guard.
 */
export async function captureAndShareWeb(domId, { fileName = "receipt.png", shareTitle, shareText } = {}) {
  if (typeof document === "undefined") throw new Error("captureAndShareWeb: no DOM");
  const node = document.getElementById(domId);
  if (!node) throw new Error("Receipt content not found");

  const dataUrl = await toPng(node, { pixelRatio: 2, cacheBust: true, backgroundColor: "#ffffff" });

  // Prefer the native share sheet (mobile browsers) with the PNG as a file.
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], fileName, { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: shareTitle, text: shareText });
      return;
    }
  } catch (_) {
    // Web Share unavailable or cancelled - fall through to download.
  }

  // Desktop / no Web Share: trigger a download.
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
