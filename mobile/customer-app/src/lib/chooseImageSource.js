import { Platform, Alert } from "react-native";

/**
 * Show a "Camera / Photo Library" chooser, then run the chosen handler.
 *
 * Native: the usual Alert action sheet (unchanged behaviour).
 * Web: browsers have no action sheet, AND react-native-web's Alert.alert does
 * not fire the per-button `onPress` callbacks — so the chooser is a dead end and
 * the upload button appears to "do nothing". Instead we skip straight to the
 * gallery handler; the browser's own file dialog already lets the user pick a
 * camera or a file. This MUST be called synchronously from the button's onPress
 * so the file dialog stays within the user-gesture (browsers block it otherwise).
 *
 * @param {() => void} onCamera  handler for the camera option (native only)
 * @param {() => void} onGallery handler for the gallery/file option
 * @param {{title?,message?,camera?,gallery?,cancel?}} labels  localized strings
 */
export function chooseImageSource(onCamera, onGallery, labels = {}) {
  if (Platform.OS === "web") {
    onGallery();
    return;
  }
  Alert.alert(labels.title || "Attach a photo", labels.message, [
    { text: labels.camera || "Camera", onPress: onCamera },
    { text: labels.gallery || "Photo Library", onPress: onGallery },
    { text: labels.cancel || "Cancel", style: "cancel" },
  ]);
}