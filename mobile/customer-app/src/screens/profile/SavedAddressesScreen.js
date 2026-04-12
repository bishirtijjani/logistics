import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme";

export default function SavedAddressesScreen({ navigation }) {
  // TODO: Wire to backend saved addresses endpoint
  const addresses = [];

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
    >
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={{ height: 4, backgroundColor: colors.primary }} />

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
            flex: 1,
          }}
        >
          Saved Addresses
        </Text>
        <TouchableOpacity
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="add" size={22} color={colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 48,
          flex: addresses.length === 0 ? 1 : undefined,
        }}
      >
        {addresses.length === 0 ? (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 40,
            }}
          >
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: colors.surfaceMuted,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <Ionicons
                name="location-outline"
                size={32}
                color={colors.textLight}
              />
            </View>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "800",
                color: colors.text,
                marginBottom: 8,
                textAlign: "center",
              }}
            >
              No saved addresses
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: colors.textMuted,
                textAlign: "center",
                lineHeight: 20,
              }}
            >
              Save your favourite addresses for faster delivery booking.
            </Text>
            <TouchableOpacity
              style={{
                backgroundColor: colors.primary,
                paddingHorizontal: 24,
                paddingVertical: 14,
                borderRadius: 14,
                marginTop: 24,
              }}
              activeOpacity={0.8}
            >
              <Text
                style={{
                  color: colors.white,
                  fontSize: 14,
                  fontWeight: "700",
                }}
              >
                Add Address
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
