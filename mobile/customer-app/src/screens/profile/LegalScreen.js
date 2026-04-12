import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme";

export default function LegalScreen({ navigation }) {
  const items = [
    {
      icon: "document-text-outline",
      label: "Terms of Service",
      url: "https://yourapp.com/terms",
    },
    {
      icon: "shield-outline",
      label: "Privacy Policy",
      url: "https://yourapp.com/privacy",
    },
    {
      icon: "receipt-outline",
      label: "Refund Policy",
      url: "https://yourapp.com/refunds",
    },
    {
      icon: "people-outline",
      label: "Community Guidelines",
      url: "https://yourapp.com/guidelines",
    },
  ];

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
          }}
        >
          Legal
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48 }}
      >
        <View
          style={{
            marginHorizontal: 20,
            backgroundColor: colors.surface,
            borderRadius: 18,
            borderWidth: 1.5,
            borderColor: colors.border,
            overflow: "hidden",
          }}
        >
          {items.map((item, index) => (
            <TouchableOpacity
              key={item.label}
              onPress={() => Linking.openURL(item.url)}
              activeOpacity={0.6}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderBottomWidth: index < items.length - 1 ? 1 : 0,
                borderBottomColor: colors.border,
              }}
            >
              <View
                style={{
                  width: 38,
                  height: 38,
                  backgroundColor: colors.surfaceMuted,
                  borderRadius: 11,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 14,
                }}
              >
                <Ionicons name={item.icon} size={19} color={colors.text} />
              </View>
              <Text
                style={{
                  flex: 1,
                  fontSize: 15,
                  fontWeight: "600",
                  color: colors.text,
                }}
              >
                {item.label}
              </Text>
              <Ionicons
                name="open-outline"
                size={17}
                color={colors.textLight}
              />
            </TouchableOpacity>
          ))}
        </View>

        <Text
          style={{
            fontSize: 12,
            color: colors.textLight,
            textAlign: "center",
            marginTop: 24,
            marginHorizontal: 20,
            lineHeight: 18,
          }}
        >
          By using this app, you agree to our Terms of Service and Privacy
          Policy. Last updated: April 2026.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
