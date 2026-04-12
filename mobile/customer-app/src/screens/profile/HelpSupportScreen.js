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

const FAQ_ITEMS = [
  {
    q: "How do I fund my wallet?",
    a: "Go to Wallet \u2192 Fund Wallet. You can fund via bank transfer to your virtual account.",
  },
  {
    q: "How long does delivery take?",
    a: "Delivery times vary by distance and rider availability. Most deliveries within Lagos complete in 30\u201360 minutes.",
  },
  {
    q: "How do I track my order?",
    a: "Once a rider is assigned, you\u2019ll see real-time tracking on the order details screen.",
  },
  {
    q: "Can I cancel an order?",
    a: "You can cancel before a rider picks up your package. Cancellation after pickup may incur a fee.",
  },
  {
    q: "What if my delivery is damaged?",
    a: "Contact support within 24 hours with photos. We\u2019ll investigate and process a refund if applicable.",
  },
];

export default function HelpSupportScreen({ navigation }) {
  const [expanded, setExpanded] = React.useState(null);

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
          Help & Support
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48 }}
      >
        {/* Contact */}
        <View style={{ marginHorizontal: 20 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: colors.textMuted,
              letterSpacing: 1,
              textTransform: "uppercase",
              marginBottom: 10,
              marginLeft: 4,
            }}
          >
            Contact Us
          </Text>
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 18,
              borderWidth: 1.5,
              borderColor: colors.border,
              overflow: "hidden",
            }}
          >
            {[
              {
                icon: "chatbubble-ellipses-outline",
                label: "Live Chat",
                sub: "Chat with our support team",
              },
              {
                icon: "mail-outline",
                label: "Email Support",
                sub: "support@yourapp.com",
                onPress: () => Linking.openURL("mailto:support@yourapp.com"),
              },
              {
                icon: "call-outline",
                label: "Phone Support",
                sub: "0800-YOURAPP",
                onPress: () => Linking.openURL("tel:08001234567"),
              },
            ].map((item, index) => (
              <TouchableOpacity
                key={item.label}
                onPress={item.onPress}
                activeOpacity={0.6}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  borderBottomWidth: index < 2 ? 1 : 0,
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
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "600",
                      color: colors.text,
                      marginBottom: 1,
                    }}
                  >
                    {item.label}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>
                    {item.sub}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={17}
                  color={colors.textLight}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* FAQ */}
        <View style={{ marginHorizontal: 20, marginTop: 24 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: colors.textMuted,
              letterSpacing: 1,
              textTransform: "uppercase",
              marginBottom: 10,
              marginLeft: 4,
            }}
          >
            Frequently Asked Questions
          </Text>
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 18,
              borderWidth: 1.5,
              borderColor: colors.border,
              overflow: "hidden",
            }}
          >
            {FAQ_ITEMS.map((item, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => setExpanded(expanded === index ? null : index)}
                activeOpacity={0.7}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  borderBottomWidth: index < FAQ_ITEMS.length - 1 ? 1 : 0,
                  borderBottomColor: colors.border,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "600",
                      color: colors.text,
                      flex: 1,
                      marginRight: 10,
                    }}
                  >
                    {item.q}
                  </Text>
                  <Ionicons
                    name={expanded === index ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={colors.textMuted}
                  />
                </View>
                {expanded === index && (
                  <Text
                    style={{
                      fontSize: 13,
                      color: colors.textMuted,
                      marginTop: 8,
                      lineHeight: 20,
                    }}
                  >
                    {item.a}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
