import React from "react";
import { View, Text, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme";

export default function AboutScreen({ navigation }) {
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
          About
        </Text>
      </View>

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
            width: 88,
            height: 88,
            borderRadius: 22,
            backgroundColor: colors.dark,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 20,
          }}
        >
          <Ionicons name="cube" size={42} color={colors.primary} />
        </View>

        <Text
          style={{
            fontSize: 24,
            fontWeight: "900",
            color: colors.text,
            marginBottom: 4,
          }}
        >
          QuickDrop
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: colors.textMuted,
            marginBottom: 24,
          }}
        >
          Version 1.0.0 (Build 1)
        </Text>

        <Text
          style={{
            fontSize: 14,
            color: colors.textMuted,
            textAlign: "center",
            lineHeight: 22,
            marginBottom: 32,
          }}
        >
          VTU & Logistics platform for seamless deliveries, airtime, data, and
          utility payments across Nigeria.
        </Text>

        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 18,
            borderWidth: 1.5,
            borderColor: colors.border,
            width: "100%",
            padding: 16,
          }}
        >
          {[
            { label: "Platform", value: "React Native + Expo" },
            { label: "Backend", value: "Node.js + PostgreSQL" },
            { label: "Region", value: "Nigeria" },
          ].map((item, index) => (
            <View
              key={item.label}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                paddingVertical: 8,
                borderBottomWidth: index < 2 ? 1 : 0,
                borderBottomColor: colors.border,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  color: colors.textMuted,
                  fontWeight: "600",
                }}
              >
                {item.label}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: colors.text,
                  fontWeight: "600",
                }}
              >
                {item.value}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <Text
        style={{
          textAlign: "center",
          color: colors.textLight,
          fontSize: 12,
          paddingBottom: 24,
        }}
      >
        {"\u00A9"} 2026 QuickDrop. All rights reserved.
      </Text>
    </SafeAreaView>
  );
}
