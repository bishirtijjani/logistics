/**
 * Helpers for picking + uploading support attachments via the existing
 * Cloudinary signed-upload flow (kind=ticket or kind=dispute).
 */

import { Platform, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import api from "../../services/api";
import { appendUploadFile } from "../../lib/uploadFile";

export const pickImage = async (source) => {
  if (Platform.OS === "web") {
    // Browser file dialog handles permission + source. Don't await a permission
    // first - that would drop the user gesture and the dialog wouldn't open.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.8,
    });
    return result.canceled ? null : result.assets?.[0]?.uri || null;
  }
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

export const uploadAttachment = async (uri, kind) => {
  const sigEnvelope = await api.post("/auth/upload-signature", { kind });
  const sig = sigEnvelope?.data;
  if (!sig) throw new Error("Failed to get upload signature");

  const filename = uri.split("/").pop();
  const match = /\.(.+)$/.exec(filename || "");
  const type = match ? `image/${match[1]}` : "image/jpeg";

  const formData = new FormData();
  await appendUploadFile(formData, uri, { name: filename || "attachment.jpg", type });
  formData.append("api_key", sig.apiKey);
  formData.append("timestamp", sig.timestamp);
  formData.append("signature", sig.signature);
  formData.append("folder", sig.folder);
  formData.append("public_id", sig.publicId);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
    {
      method: "POST",
      body: formData,
      // On web, fetch must set the multipart boundary itself, so don't pin
      // Content-Type there; native RN keeps the explicit header it expects.
      headers:
        Platform.OS === "web"
          ? { Accept: "application/json" }
          : { Accept: "application/json", "Content-Type": "multipart/form-data" },
    },
  );

  if (!response.ok) {
    const txt = await response.text().catch(() => "");
    throw new Error(`Cloudinary upload failed: ${txt || response.status}`);
  }
  const data = await response.json();
  return data.secure_url;
};
