import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSelector } from "react-redux";
import { useTheme } from "../theme";

// Screens
import HomeScreen from "../screens/main/HomeScreen";
import OrdersScreen from "../screens/main/OrdersScreen";
import WalletScreen from "../screens/main/WalletScreen";
import CartScreen from "../screens/main/CartScreen";

import { computeCartCount } from "../lib/cart";

const Tab = createBottomTabNavigator();

export default function MainTabNavigator() {
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();
  // Cart badge = total units, not lines, since "3× Burger" should read as 3
  // items not 1. Pulled inline so the badge live-updates without rerendering
  // the whole tab navigator's screenOptions.
  const cartCount = useSelector((s) => computeCartCount(s.cart?.lines || []));

  return (
    <Tab.Navigator
      // Opaque per-scene background. bottom-tabs does NOT apply the navigation
      // theme's `background` to tab scenes - they're transparent by default - so
      // without this, web tab switches briefly reveal the other tabs' content
      // through the incoming screen. `sceneStyle` is the intended API for it.
      sceneStyle={{ backgroundColor: tokens.bg.canvas }}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === "HomeTab") {
            iconName = focused ? "home" : "home-outline";
          } else if (route.name === "OrdersTab") {
            iconName = focused ? "document-text" : "document-text-outline";
          } else if (route.name === "WalletTab") {
            iconName = focused ? "wallet" : "wallet-outline";
          } else if (route.name === "CartTab") {
            iconName = focused ? "bag-handle" : "bag-handle-outline";
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: tokens.brand.default,
        tabBarInactiveTintColor: tokens.text.muted,
        tabBarStyle: {
          backgroundColor: tokens.bg.surface,
          borderTopWidth: 1,
          borderTopColor: tokens.border.default,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          paddingTop: 5,
          height: 60 + (insets.bottom > 0 ? insets.bottom : 8),
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "500",
        },
        tabBarBadgeStyle: {
          backgroundColor: tokens.brand.default,
          color: tokens.text.onBrand,
          fontSize: 10,
          fontWeight: "800",
          minWidth: 18,
          height: 18,
          lineHeight: 18,
        },
      })}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{ title: "Home" }}
      />
      <Tab.Screen
        name="OrdersTab"
        component={OrdersScreen}
        options={{ title: "Orders" }}
      />
      <Tab.Screen
        name="WalletTab"
        component={WalletScreen}
        options={{ title: "Wallet" }}
      />
      <Tab.Screen
        name="CartTab"
        component={CartScreen}
        options={{
          title: "Cart",
          // `> 0 ? count : undefined` is required - passing 0 or null still
          // renders the empty badge dot in @react-navigation/bottom-tabs.
          tabBarBadge: cartCount > 0 ? (cartCount > 99 ? "99+" : cartCount) : undefined,
        }}
      />
    </Tab.Navigator>
  );
}
