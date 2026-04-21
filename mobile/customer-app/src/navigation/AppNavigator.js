import React, { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useSelector, useDispatch } from "react-redux";
import { hydrateAuth } from "../store/slices/authSlice";

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

// Wallet Screens
import FundWalletScreen from "../screens/wallet/FundWalletScreen";
import TransactionHistoryScreen from "../screens/wallet/TransactionHistoryScreen";

// Utility Screens
import AirtimeScreen from "../screens/utility/AirtimeScreen";
import DataScreen from "../screens/utility/DataScreen";
import UtilityHistoryScreen from "../screens/utility/UtilityHistoryScreen";

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const dispatch = useDispatch();
  const { isAuthenticated, isHydrating } = useSelector((state) => state.auth);

  useEffect(() => {
    dispatch(hydrateAuth());
  }, [dispatch]);

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

            {/* Wallet Screens */}
            <Stack.Screen name="FundWallet" component={FundWalletScreen} />
            <Stack.Screen name="TransactionHistory" component={TransactionHistoryScreen} />

            {/* Utility Screens */}
            <Stack.Screen name="Airtime" component={AirtimeScreen} />
            <Stack.Screen name="Data" component={DataScreen} />
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
