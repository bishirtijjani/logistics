import { Platform } from "react-native";

/**
 * Append an image to a Cloudinary multipart form in a cross-platform way.
 *
 * Native (iOS/Android): React Native's FormData takes a { uri, name, type }
 * descriptor and streams the file from disk - identical to the original code.
 * Web: FormData needs a real Blob (the { uri } descriptor would be serialised to
 * "[object Object]"), so fetch the data:/blob:/http: URI into a Blob and append
 * that. expo-image-picker on web returns exactly such a URI.
 */
export async function appendUploadFile(
  form,
  uri,
  { name = "upload.jpg", type = "image/jpeg" } = {}
) {
  if (Platform.OS === "web") {
    const blob = await fetch(uri).then((r) => r.blob());
    form.append("file", blob, name);
    return;
  }
  form.append("file", {
    uri: Platform.OS === "ios" ? uri.replace("file://", "") : uri,
    name,
    type,
  });
}
