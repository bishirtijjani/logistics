import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { colors } from "../../theme";
import { updateProfile, fetchProfile } from "../../store/slices/profileSlice";

export default function SavedAddressesScreen({ navigation }) {
  const dispatch = useDispatch();
  const { profile, isUpdating } = useSelector((state) => state.profile);
  
  const [address, setAddress] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  // Load address from profile
  useEffect(() => {
    if (profile?.address) {
      setAddress(profile.address);
    }
  }, [profile]);

  // Warn about unsaved changes
  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (!hasChanges) return;
      
      e.preventDefault();
      Alert.alert(
        "Unsaved Changes",
        "You have unsaved changes. Save before leaving?",
        [
          { text: "Discard", style: "destructive", onPress: () => navigation.dispatch(e.data.action) },
          { text: "Save", onPress: () => handleSave(navigation.dispatch(e.data.action)) },
          { text: "Cancel", style: "cancel" },
        ]
      );
    });

    return unsubscribe;
  }, [navigation, hasChanges, address]);

  const handleAddressChange = (text) => {
    setAddress(text);
    setHasChanges(true);
  };

  const handleSave = useCallback(
    async (afterSaveCallback) => {
      if (!address.trim()) {
        Toast.show({
          type: "error",
          text1: "Address Required",
          text2: "Please enter your address",
        });
        return;
      }

      const result = await dispatch(updateProfile({ address: address.trim() }));

      if (updateProfile.fulfilled.match(result)) {
        setHasChanges(false);
        Toast.show({
          type: "success",
          text1: "Address Saved",
          text2: "Your delivery address has been updated",
        });
        if (afterSaveCallback) afterSaveCallback();
      } else {
        Toast.show({
          type: "error",
          text1: "Error",
          text2: result.payload || "Failed to save address",
        });
      }
    },
    [dispatch, address]
  );

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
          justifyContent: "space-between",
          paddingHorizontal: 20,
          paddingVertical: 16,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
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
            Delivery Address
          </Text>
        </View>
        {isUpdating ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <TouchableOpacity
            onPress={() => handleSave()}
            disabled={!hasChanges}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 8,
              backgroundColor: hasChanges ? colors.primary : colors.border,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: hasChanges ? "#fff" : colors.textMuted,
              }}
            >
              Save
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20 }}
      >
        {/* Address Info Card */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 20,
            borderWidth: 1.5,
            borderColor: colors.border,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: colors.primary + "20",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 14,
              }}
            >
              <Ionicons name="home-outline" size={24} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: colors.text,
                  marginBottom: 2,
                }}
              >
                Primary Address
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: colors.textMuted,
                }}
              >
                Used for all deliveries
              </Text>
            </View>
          </View>

          <Text
            style={{
              fontSize: 13,
              fontWeight: "600",
              color: colors.textMuted,
              marginBottom: 8,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Full Address
          </Text>
          <TextInput
            value={address}
            onChangeText={handleAddressChange}
            placeholder="Enter your full delivery address..."
            placeholderTextColor={colors.textLight}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            style={{
              backgroundColor: colors.background,
              borderRadius: 12,
              padding: 16,
              fontSize: 15,
              color: colors.text,
              borderWidth: 1.5,
              borderColor: hasChanges ? colors.primary : colors.border,
              minHeight: 120,
              lineHeight: 22,
            }}
          />

          {hasChanges && (
            <Text
              style={{
                fontSize: 12,
                color: colors.primary,
                marginTop: 8,
              }}
            >
              <Ionicons name="information-circle" size={12} /> You have unsaved changes
            </Text>
          )}
        </View>

        {/* Tips */}
        <View
          style={{
            marginTop: 24,
            backgroundColor: colors.surfaceMuted,
            borderRadius: 12,
            padding: 16,
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: "700",
              color: colors.text,
              marginBottom: 8,
            }}
          >
            <Ionicons name="bulb-outline" size={16} /> Tips for accurate delivery
          </Text>
          <Text style={{ fontSize: 13, color: colors.textMuted, lineHeight: 20 }}>
            • Include house number and street name{"\n"}
            • Add nearby landmark for easier location{"\n"}
            • Include city and state information
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
