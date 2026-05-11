import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, Text, TouchableOpacity } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useSelector, useDispatch } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { hydrateAuth, logout } from "../store/slices/authSlice";
import socketService from "../services/socket";
import { subscribeToWalletSocket } from "../store/slices/walletSlice";
import { fetchPublicSettings } from "../store/slices/settingsSlice";
import {
  isBiometricAvailable,
  isBiometricEnabled,
  authenticateWithBiometric,
} from "../services/biometric";

// Auth Screens
import LoginScreen from "../screens/auth/LoginScreen";
import RegisterScreen from "../screens/auth/RegisterScreen";
import OtpVerificationScreen from "../screens/auth/OtpVerificationScreen";
import ForgotPasswordScreen from "../screens/auth/ForgotPasswordScreen";
import ResetPasswordScreen from "../screens/auth/ResetPasswordScreen";

// Main
import MainTabNavigator from "./MainTabNavigator";

// Profile Screens
import EditProfileScreen from "../screens/profile/EditProfileScreen";
import ProfilePhotoScreen from "../screens/profile/ProfilePhotoScreen";
import BvnVerificationScreen from "../screens/profile/BvnVerificationScreen";
import SetPinScreen from "../screens/profile/SetPinScreen";
import ChangePinScreen from "../screens/profile/ChangePinScreen";
import SecuritySettingsScreen from "../screens/profile/SecuritySettingsScreen";
import NotificationSettingsScreen from "../screens/profile/NotificationSettingsScreen";
import SavedAddressesScreen from "../screens/profile/SavedAddressesScreen";
import HelpSupportScreen from "../screens/profile/HelpSupportScreen";
import LegalScreen from "../screens/profile/LegalScreen";
import AboutScreen from "../screens/profile/AboutScreen";

// Location
import LocationPickerScreen from "../screens/location/LocationPickerScreen";

// Delivery Screens
import CreateDeliveryScreen from "../screens/delivery/CreateDeliveryScreen";
import TrackDeliveryScreen from "../screens/delivery/TrackDeliveryScreen";
import RateDeliveryScreen from "../screens/delivery/RateDeliveryScreen";

// Merchant Screens (NEW - Unified Request Architecture)
import MerchantBrowseScreen from "../screens/merchant/MerchantBrowseScreen";
import MerchantMenuScreen from "../screens/merchant/MerchantMenuScreen";

// Request Screens (NEW - Unified Request Architecture)
import CheckoutScreen from "../screens/request/CheckoutScreen";
import RequestTrackingScreen from "../screens/request/RequestTrackingScreen";

// Wallet Screens
import FundWalletScreen from "../screens/wallet/FundWalletScreen";
import TransactionHistoryScreen from "../screens/wallet/TransactionHistoryScreen";
import SendMoneyScreen from "../screens/wallet/SendMoneyScreen";
import WithdrawScreen from "../screens/wallet/WithdrawScreen";
import SavedBeneficiariesScreen from "../screens/wallet/SavedBeneficiariesScreen";
import ReceiptScreen from "../screens/wallet/ReceiptScreen";

// Security / Sessions
import SessionsScreen from "../screens/profile/SessionsScreen";
import PhoneChangeScreen from "../screens/profile/PhoneChangeScreen";

// Utility Screens
import AirtimeScreen from "../screens/utility/AirtimeScreen";
import DataScreen from "../screens/utility/DataScreen";
import CableScreen from "../screens/utility/CableScreen";
import ElectricityScreen from "../screens/utility/ElectricityScreen";
import UtilityHistoryScreen from "../screens/utility/UtilityHistoryScreen";

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const dispatch = useDispatch();
  const { isAuthenticated, isHydrating } = useSelector((state) => state.auth);

  // Biometric gate states:
  //   'pending'  — checking whether to prompt
  //   'required' — user enabled biometrics; show locked screen + retry
  //   'passed'   — authenticated this session; main UI may render
  const [bioGate, setBioGate] = useState("pending");

  useEffect(() => {
    dispatch(hydrateAuth());
    dispatch(fetchPublicSettings());
  }, [dispatch]);

  // After hydration, decide whether the user must pass a biometric prompt
  // before seeing the main UI. Skipped entirely for unauthenticated users
  // (the auth flow is the gate in that case) and for devices without
  // enrolled biometrics.
  useEffect(() => {
    if (isHydrating) return;
    if (!isAuthenticated) {
      setBioGate("passed");
      return;
    }
    let cancelled = false;
    (async () => {
      const [enabled, available] = await Promise.all([
        isBiometricEnabled(),
        isBiometricAvailable(),
      ]);
      if (cancelled) return;
      if (!enabled || !available) {
        setBioGate("passed");
        return;
      }
      setBioGate("required");
      const ok = await authenticateWithBiometric("Unlock VTU Logistics");
      if (cancelled) return;
      setBioGate(ok ? "passed" : "required");
    })();
    return () => {
      cancelled = true;
    };
  }, [isHydrating, isAuthenticated]);

  const retryBiometric = async () => {
    const ok = await authenticateWithBiometric("Unlock VTU Logistics");
    if (ok) setBioGate("passed");
  };

  // Connect socket when authenticated AND past the biometric gate; otherwise
  // disconnect so we don't keep a privileged socket open behind a lock.
  useEffect(() => {
    if (isAuthenticated && bioGate === "passed") {
      socketService.connect();
      const unsub = dispatch(subscribeToWalletSocket());
      return () => {
        if (typeof unsub === 'function') unsub();
      };
    } else {
      socketService.disconnect();
    }
  }, [isAuthenticated, bioGate, dispatch]);

  if (isHydrating) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#f4f4f7",
        }}
      >
        <ActivityIndicator size="large" color="#EA580C" />
      </View>
    );
  }

  if (isAuthenticated && bioGate !== "passed") {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#f4f4f7",
          paddingHorizontal: 32,
        }}
      >
        <Ionicons name="finger-print" size={72} color="#EA580C" />
        <Text style={{ marginTop: 24, fontSize: 22, fontWeight: "800", color: "#111827" }}>
          Locked
        </Text>
        <Text
          style={{
            marginTop: 8,
            fontSize: 14,
            color: "#6B7280",
            textAlign: "center",
            lineHeight: 20,
          }}
        >
          Authenticate with biometrics to continue.
        </Text>
        <TouchableOpacity
          onPress={retryBiometric}
          style={{
            marginTop: 28,
            backgroundColor: "#EA580C",
            paddingVertical: 14,
            paddingHorizontal: 32,
            borderRadius: 14,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
            Use biometrics
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => dispatch(logout())}
          style={{ marginTop: 16, paddingVertical: 10 }}
        >
          <Text style={{ color: "#6B7280", fontWeight: "600", fontSize: 14 }}>
            Sign out instead
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          // Main App
          <>
            <Stack.Screen name="MainTabs" component={MainTabNavigator} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} />
            <Stack.Screen name="ProfilePhoto" component={ProfilePhotoScreen} />
            <Stack.Screen
              name="BvnVerification"
              component={BvnVerificationScreen}
            />
            <Stack.Screen name="SetPin" component={SetPinScreen} />
            <Stack.Screen name="ChangePin" component={ChangePinScreen} />
            <Stack.Screen
              name="SecuritySettings"
              component={SecuritySettingsScreen}
            />
            <Stack.Screen
              name="NotificationSettings"
              component={NotificationSettingsScreen}
            />
            <Stack.Screen
              name="SavedAddresses"
              component={SavedAddressesScreen}
            />
            <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
            <Stack.Screen name="Legal" component={LegalScreen} />
            <Stack.Screen name="About" component={AboutScreen} />
            <Stack.Screen
              name="LocationPicker"
              component={LocationPickerScreen}
              options={{
                presentation: "modal",
                animation: "slide_from_bottom",
              }}
            />

            {/* Delivery Flow */}
            <Stack.Screen name="CreateDelivery" component={CreateDeliveryScreen} />
            <Stack.Screen name="TrackDelivery" component={TrackDeliveryScreen} />
            <Stack.Screen name="RateDelivery" component={RateDeliveryScreen} />

            {/* Merchant Flow (NEW - Unified Request Architecture) */}
            <Stack.Screen name="MerchantBrowse" component={MerchantBrowseScreen} />
            <Stack.Screen name="MerchantMenu" component={MerchantMenuScreen} />

            {/* Request Flow (NEW - Unified Request Architecture) */}
            <Stack.Screen name="Checkout" component={CheckoutScreen} />
            <Stack.Screen name="RequestTracking" component={RequestTrackingScreen} />

            {/* Wallet Screens */}
            <Stack.Screen name="FundWallet" component={FundWalletScreen} />
            <Stack.Screen name="TransactionHistory" component={TransactionHistoryScreen} />
            <Stack.Screen name="SendMoney" component={SendMoneyScreen} />
            <Stack.Screen name="Withdraw" component={WithdrawScreen} />
            <Stack.Screen name="SavedBeneficiaries" component={SavedBeneficiariesScreen} />
            <Stack.Screen name="Receipt" component={ReceiptScreen} />

            {/* Security */}
            <Stack.Screen name="Sessions" component={SessionsScreen} />
            <Stack.Screen name="PhoneChange" component={PhoneChangeScreen} />

            {/* Utility Screens */}
            <Stack.Screen name="Airtime" component={AirtimeScreen} />
            <Stack.Screen name="Data" component={DataScreen} />
            <Stack.Screen name="Cable" component={CableScreen} />
            <Stack.Screen name="Electricity" component={ElectricityScreen} />
            <Stack.Screen name="UtilityHistory" component={UtilityHistoryScreen} />
          </>
        ) : (
          // Auth Flow
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen
              name="OtpVerification"
              component={OtpVerificationScreen}
            />
            <Stack.Screen
              name="ForgotPassword"
              component={ForgotPasswordScreen}
            />
            <Stack.Screen
              name="ResetPassword"
              component={ResetPasswordScreen}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
