import React, { useEffect, useRef } from "react";
import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSelector } from "react-redux";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../theme";
import { useT } from "../i18n/useT";

import HomeTabScreen from "../features/availability/HomeTabScreen";
import EarningsDashboardScreen from "../features/earnings/EarningsDashboardScreen";
import WalletHomeScreen from "../features/wallet/WalletHomeScreen";
import ProfileHomeScreen from "../features/profile/ProfileHomeScreen";
import TripCockpitScreen from "../features/trip/TripCockpitScreen";

const Tab = createBottomTabNavigator();

const iconFor = (routeName, focused) => {
  const map = {
    HomeTab:     focused ? "home" : "home-outline",
    TripTab:     focused ? "bicycle" : "bicycle-outline",
    EarningsTab: focused ? "stats-chart" : "stats-chart-outline",
    WalletTab:   focused ? "wallet" : "wallet-outline",
    MeTab:       focused ? "person" : "person-outline",
  };
  return map[routeName] || "ellipse-outline";
};

export default function MainTabNavigator() {
  const { tokens } = useTheme();
  const { t } = useT();
  const activeRequestId = useSelector((s) => s.trip.activeRequestId);
  const tripStatus = useSelector((s) => s.trip.status);
  const navigation = useNavigation();
  const lastActiveRequestRef = useRef(null);

  // Phase 4 — when a trip becomes active, jump to it. Skip on every render —
  // only fire on the leading edge of activeRequestId changing to non-null.
  useEffect(() => {
    if (activeRequestId && activeRequestId !== lastActiveRequestRef.current) {
      lastActiveRequestRef.current = activeRequestId;
      try { navigation.navigate("TripTab"); } catch (_) {}
    } else if (!activeRequestId) {
      lastActiveRequestRef.current = null;
    }
  }, [activeRequestId, navigation]);

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
      <Tab.Screen
        name="HomeTab"
        component={HomeTabScreen}
        options={{ tabBarLabel: t("tabs.home", "Home") }}
      />
      {activeRequestId ? (
        <Tab.Screen
          name="TripTab"
          component={TripCockpitScreen}
          options={{
            tabBarLabel: t("tabs.trip", "Trip"),
            // Pulse the badge while an action is required from the rider.
            tabBarBadge: tripStatus ? "•" : undefined,
            tabBarBadgeStyle: { backgroundColor: tokens.brand.default, color: tokens.text.onBrand },
          }}
        />
      ) : null}
      <Tab.Screen
        name="EarningsTab"
        component={EarningsDashboardScreen}
        options={{ tabBarLabel: t("tabs.earnings", "Earnings") }}
      />
      <Tab.Screen
        name="WalletTab"
        component={WalletHomeScreen}
        options={{ tabBarLabel: t("tabs.wallet", "Wallet") }}
      />
      <Tab.Screen
        name="MeTab"
        component={ProfileHomeScreen}
        options={{ tabBarLabel: t("tabs.me", "Me") }}
      />
    </Tab.Navigator>
  );
}
