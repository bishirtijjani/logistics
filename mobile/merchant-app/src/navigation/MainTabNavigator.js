import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme";
import { useT } from "../i18n/useT";
import OrdersScreen from "../features/orders/OrdersScreen";
import WebAppScreen from "../features/more/WebAppScreen";
import MoreScreen from "../features/more/MoreScreen";

const Tab = createBottomTabNavigator();

const ICONS = {
  Orders: ["bag-handle", "bag-handle-outline"],
  Products: ["cube", "cube-outline"],
  Earnings: ["wallet", "wallet-outline"],
  More: ["grid", "grid-outline"],
};

// Bottom bar mirrors the web dashboard's mobile BottomNav so the two surfaces
// read as one app. "More" is a native hub; the rest are native or WebView
// sections.
export default function MainTabNavigator() {
  const { tokens } = useTheme();
  const { t } = useT();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: tokens.brand.default,
        tabBarInactiveTintColor: tokens.text.muted,
        tabBarStyle: {
          backgroundColor: tokens.bg.surface,
          borderTopColor: tokens.border.default,
        },
        sceneStyle: { backgroundColor: tokens.bg.canvas },
        tabBarIcon: ({ focused, color, size }) => {
          const [active, inactive] = ICONS[route.name] || ["ellipse", "ellipse-outline"];
          return <Ionicons name={focused ? active : inactive} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Orders"
        component={OrdersScreen}
        options={{ tabBarLabel: t("merchant.tabOrders", "Orders") }}
      />
      <Tab.Screen
        name="Products"
        component={WebAppScreen}
        initialParams={{ initialPath: "/dashboard/menu", title: t("merchant.tabProducts", "Products") }}
        options={{ tabBarLabel: t("merchant.tabProducts", "Products") }}
      />
      <Tab.Screen
        name="Earnings"
        component={WebAppScreen}
        initialParams={{ initialPath: "/dashboard/earnings", title: t("tabs.earnings", "Earnings") }}
        options={{ tabBarLabel: t("tabs.earnings", "Earnings") }}
      />
      <Tab.Screen
        name="More"
        component={MoreScreen}
        options={{ tabBarLabel: t("tabs.more", "More") }}
      />
    </Tab.Navigator>
  );
}
