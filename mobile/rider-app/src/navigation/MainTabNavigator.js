import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useTheme } from "../theme";

import HomeTabScreen from "../features/availability/HomeTabScreen";
import EarningsDashboardScreen from "../features/earnings/EarningsDashboardScreen";
import WalletHomeScreen from "../features/wallet/WalletHomeScreen";
import ProfileHomeScreen from "../features/profile/ProfileHomeScreen";

const Tab = createBottomTabNavigator();

const iconFor = (routeName, focused) => {
  const map = {
    HomeTab:     focused ? "home" : "home-outline",
    EarningsTab: focused ? "stats-chart" : "stats-chart-outline",
    WalletTab:   focused ? "wallet" : "wallet-outline",
    MeTab:       focused ? "person" : "person-outline",
  };
  return map[routeName] || "ellipse-outline";
};

export default function MainTabNavigator() {
  const { tokens } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: tokens.brand.default,
        tabBarInactiveTintColor: tokens.text.muted,
        tabBarStyle: {
          backgroundColor: tokens.bg.surface,
          borderTopColor: tokens.border.default,
        },
        tabBarIcon: ({ focused, color, size }) => (
          <Ionicons name={iconFor(route.name, focused)} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeTabScreen} options={{ tabBarLabel: "Home" }} />
      <Tab.Screen name="EarningsTab" component={EarningsDashboardScreen} options={{ tabBarLabel: "Earnings" }} />
      <Tab.Screen name="WalletTab" component={WalletHomeScreen} options={{ tabBarLabel: "Wallet" }} />
      <Tab.Screen name="MeTab" component={ProfileHomeScreen} options={{ tabBarLabel: "Me" }} />
    </Tab.Navigator>
  );
}
