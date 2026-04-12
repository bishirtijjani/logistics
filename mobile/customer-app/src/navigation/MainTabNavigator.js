import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Screens
import HomeScreen from "../screens/main/HomeScreen";
import OrdersScreen from "../screens/main/OrdersScreen";
import WalletScreen from "../screens/main/WalletScreen";
import ProfileScreen from "../screens/profile/ProfileScreen";

const Tab = createBottomTabNavigator();

export default function MainTabNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
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
          } else if (route.name === "ProfileTab") {
            iconName = focused ? "person" : "person-outline";
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#EA580C",
        tabBarInactiveTintColor: "#6b7280",
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopWidth: 1,
          borderTopColor: "#f3f4f6",
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          paddingTop: 5,
          height: 60 + (insets.bottom > 0 ? insets.bottom : 8),
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "500",
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
        name="ProfileTab"
        component={ProfileScreen}
        options={{ title: "Profile" }}
      />
    </Tab.Navigator>
  );
}
