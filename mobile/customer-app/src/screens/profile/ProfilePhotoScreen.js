import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import Toast from "react-native-toast-message";
import { updateProfilePicture } from "../../store/slices/profileSlice";
import { colors } from "../../theme";

export default function ProfilePhotoScreen({ navigation }) {
  const dispatch = useDispatch();
  const { profile } = useSelector((state) => state.profile);
  const [localUri, setLocalUri] = useState(null);
  const [uploading, setUploading] = useState(false);

  const currentPhoto = localUri || profile?.profilePicture;
  const initials =
    (profile?.firstName?.[0] || "") + (profile?.lastName?.[0] || "");

  const pickImage = async (source) => {
    let result;

    if (source === "camera") {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Permission needed",
          "Camera access is required to take a photo.",
        );
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
    } else {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission needed", "Photo library access is required.");
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
    }

    if (!result.canceled && result.assets?.[0]) {
      setLocalUri(result.assets[0].uri);
    }
  };

  const showPickerOptions = () => {
    Alert.alert("Profile Photo", "Choose a source", [
      { text: "Camera", onPress: () => pickImage("camera") },
      { text: "Photo Library", onPress: () => pickImage("gallery") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleSave = async () => {
    if (!localUri) return;
    setUploading(true);

    // In production, upload to cloud storage first, then pass the URL.
    // For now, we send the local URI as a placeholder.
    // TODO: Replace with actual upload to S3/Cloudinary
    const result = await dispatch(updateProfilePicture(localUri));

    setUploading(false);
    if (updateProfilePicture.fulfilled.match(result)) {
      Toast.show({
        type: "success",
        text1: "Photo updated",
        text2: "Your profile photo has been saved.",
      });
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
    >
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={{ height: 4, backgroundColor: colors.primary }} />

      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingVertical: 16,
        }}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: colors.surfaceMuted,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 14,
          }}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text
          style={{
            fontSize: 20,
            fontWeight: "900",
            color: colors.text,
            letterSpacing: -0.5,
          }}
        >
          Profile Photo
        </Text>
      </View>

      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 20,
        }}
      >
        {/* Photo Preview */}
        <TouchableOpacity onPress={showPickerOptions} activeOpacity={0.8}>
          {currentPhoto ? (
            <View>
              <Image
                source={{ uri: currentPhoto }}
                style={{
                  width: 180,
                  height: 180,
                  borderRadius: 90,
                  borderWidth: 4,
                  borderColor: colors.primary,
                }}
              />
              <View
                style={{
                  position: "absolute",
                  bottom: 8,
                  right: 8,
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 3,
                  borderColor: colors.background,
                }}
              >
                <Ionicons name="camera" size={20} color={colors.white} />
              </View>
            </View>
          ) : (
            <View>
              <View
                style={{
                  width: 180,
                  height: 180,
                  borderRadius: 90,
                  backgroundColor: colors.dark,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 4,
                  borderColor: colors.border,
                }}
              >
                <Text
                  style={{
                    color: colors.white,
                    fontSize: 56,
                    fontWeight: "900",
                  }}
                >
                  {initials.toUpperCase() || "?"}
                </Text>
              </View>
              <View
                style={{
                  position: "absolute",
                  bottom: 8,
                  right: 8,
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 3,
                  borderColor: colors.background,
                }}
              >
                <Ionicons name="camera" size={20} color={colors.white} />
              </View>
            </View>
          )}
        </TouchableOpacity>

        <Text
          style={{
            fontSize: 14,
            color: colors.textMuted,
            marginTop: 20,
            textAlign: "center",
          }}
        >
          Tap the photo to change it
        </Text>

        {/* Action Buttons */}
        <View style={{ width: "100%", marginTop: 40 }}>
          <TouchableOpacity
            style={{
              width: "100%",
              padding: 16,
              borderRadius: 16,
              alignItems: "center",
              backgroundColor:
                !localUri || uploading ? "#9CA3AF" : colors.primary,
            }}
            onPress={handleSave}
            disabled={!localUri || uploading}
            activeOpacity={0.8}
          >
            {uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>
                Save Photo
              </Text>
            )}
          </TouchableOpacity>

          {currentPhoto && (
            <TouchableOpacity
              onPress={showPickerOptions}
              style={{
                width: "100%",
                padding: 16,
                borderRadius: 16,
                alignItems: "center",
                marginTop: 10,
                backgroundColor: colors.surfaceMuted,
                borderWidth: 1.5,
                borderColor: colors.border,
              }}
              activeOpacity={0.8}
            >
              <Text
                style={{
                  color: colors.text,
                  fontSize: 15,
                  fontWeight: "700",
                }}
              >
                Choose Different Photo
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
