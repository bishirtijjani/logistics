import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme";
import { useT } from "../i18n/useT";
import OrdersScreen from "../features/orders/OrdersScreen";
import NotificationsScreen from "../features/notifications/NotificationsScreen";
import WebAppScreen from "../features/more/WebAppScreen";
import SettingsScreen from "../features/settings/SettingsScreen";

const Tab = createBottomTabNavigator();

const ICONS = {
  Orders: ["bag-handle", "bag-handle-outline"],
  Notifications: ["notifications", "notifications-outline"],
  More: ["grid", "grid-outline"],
  Settings: ["settings", "settings-outline"],
};

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
        name="Notifications"
        component={NotificationsScreen}
        options={{ tabBarLabel: t("tabs.notifications", "Alerts") }}
      />
      <Tab.Screen
        name="More"
        component={WebAppScreen}
        options={{ tabBarLabel: t("merchant.tabMore", "More") }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarLabel: t("tabs.settings", "Settings") }}
      />
    </Tab.Navigator>
  );
}
