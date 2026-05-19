/**
 * Helpers for picking + uploading support attachments. Wraps the existing
 * Cloudinary signed-upload flow (`uploadToCloudinary` from services/cloudinary)
 * with the `ticket` / `dispute` upload kinds.
 */

import { Platform, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { uploadToCloudinary } from "../../services/cloudinary";

export const pickImage = async (source) => {
  if (source === "camera") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Camera access is required to take a photo.");
      return null;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.8,
    });
    return result.canceled ? null : result.assets?.[0]?.uri || null;
  }
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert("Permission needed", "Library access is required to choose a photo.");
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: false,
    quality: 0.8,
  });
  return result.canceled ? null : result.assets?.[0]?.uri || null;
};

/**
 * Upload a local image to Cloudinary under the given support kind.
 * Returns the Cloudinary secure_url.
 */
export const uploadAttachment = async (localUri, kind = "ticket") => {
  const mimeType =
    Platform.OS === "ios"
      ? "image/jpeg" // Photos pickers default to JPEG.
      : "image/jpeg";
  const { secureUrl } = await uploadToCloudinary({
    kind, // "ticket" or "dispute"
    localUri,
    mimeType,
  });
  return secureUrl;
};
