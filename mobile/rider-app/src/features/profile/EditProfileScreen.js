/**
 * EditProfileScreen — first name / last name / DOB / address.
 * Email is locked (use support); phone changes flow through PhoneChangeScreen.
 */

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import { useTheme } from "../../theme";
import { updateProfile, fetchProfile } from "../../store/slices/profileSlice";

export default function EditProfileScreen() {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const profile = useSelector((s) => s.profile?.profile);
  const isUpdating = useSelector((s) => s.profile?.isUpdating);

  const [firstName, setFirstName] = useState(profile?.firstName || "");
  const [lastName, setLastName] = useState(profile?.lastName || "");
  const [address, setAddress] = useState(profile?.address || "");
  const [dateOfBirth, setDateOfBirth] = useState(
    profile?.dateOfBirth ? new Date(profile.dateOfBirth).toISOString().split("T")[0] : "",
  );
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (profile) {
      setFirstName(profile.firstName || "");
      setLastName(profile.lastName || "");
      setAddress(profile.address || "");
      setDateOfBirth(profile.dateOfBirth ? new Date(profile.dateOfBirth).toISOString().split("T")[0] : "");
    }
  }, [profile]);

  const onChange = (setter) => (val) => {
    setter(val);
    setDirty(true);
  };

  const onSave = async () => {
    if (firstName.trim().length < 2 || lastName.trim().length < 2) {
      Toast.show({ type: "error", text1: t("edit.nameRequired", "Names must be at least 2 characters.") });
      return;
    }
    if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      Toast.show({ type: "error", text1: t("edit.dobInvalid", "Use date format YYYY-MM-DD") });
      return;
    }
    const payload = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
    };
    if (address.trim()) payload.address = address.trim();
    if (dateOfBirth) payload.dateOfBirth = dateOfBirth;

    try {
      await dispatch(updateProfile(payload)).unwrap();
      Toast.show({ type: "success", text1: t("edit.saved", "Profile updated") });
      dispatch(fetchProfile()).catch?.(() => {});
      navigation.goBack();
    } catch (err) {
      Toast.show({ type: "error", text1: err?.message || t("edit.failed", "Couldn't save changes") });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <View
        style={{
          flexDirection: "row", alignItems: "center",
          paddingHorizontal: 14, paddingVertical: 12,
          backgroundColor: tokens.bg.surface,
          borderBottomWidth: 1, borderBottomColor: tokens.border.default,
        }}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={22} color={tokens.text.primary} />
        </TouchableOpacity>
        <Text accessibilityRole="header" style={{ marginLeft: 10, fontSize: 17, fontWeight: "800", color: tokens.text.primary }}>
          {t("edit.title", "Edit Profile")}
        </Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          <Field
            tokens={tokens}
            label={t("edit.email", "Email")}
            icon="mail-outline"
            value={profile?.email || "—"}
            readOnly
            hint={t("edit.emailReadonly", "Contact support to change your email.")}
          />
          <Field
            tokens={tokens}
            label={t("edit.firstName", "First name")}
            icon="person-outline"
            value={firstName}
            onChangeText={onChange(setFirstName)}
            editable={!isUpdating}
          />
          <Field
            tokens={tokens}
            label={t("edit.lastName", "Last name")}
            icon="person-outline"
            value={lastName}
            onChangeText={onChange(setLastName)}
            editable={!isUpdating}
          />
          <Field
            tokens={tokens}
            label={t("edit.phone", "Phone")}
            icon="call-outline"
            value={profile?.phone || "—"}
            readOnly
            hint={t("edit.phoneNote", "Phone changes require verification — use 'Change phone number' in Security.")}
          />
          <Field
            tokens={tokens}
            label={t("edit.dob", "Date of birth")}
            icon="calendar-outline"
            value={dateOfBirth}
            placeholder="YYYY-MM-DD"
            onChangeText={onChange(setDateOfBirth)}
            editable={!isUpdating}
          />
          <Field
            tokens={tokens}
            label={t("edit.address", "Address")}
            icon="location-outline"
            value={address}
            onChangeText={onChange(setAddress)}
            editable={!isUpdating}
          />

          <TouchableOpacity
            onPress={onSave}
            disabled={!dirty || isUpdating}
            accessibilityRole="button"
            style={{
              marginTop: 12,
              paddingVertical: 14, borderRadius: 14,
              backgroundColor: !dirty || isUpdating ? tokens.bg.surfaceMuted : tokens.brand.default,
              alignItems: "center",
            }}
          >
            {isUpdating ? (
              <ActivityIndicator color={tokens.text.onBrand} />
            ) : (
              <Text style={{ color: !dirty ? tokens.text.muted : tokens.text.onBrand, fontWeight: "800", fontSize: 15 }}>
                {t("edit.save", "Save changes")}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ tokens, label, icon, value, onChangeText, placeholder, editable = true, readOnly, hint }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.text.muted, marginBottom: 6 }}>
        {label}
      </Text>
      <View style={{
        flexDirection: "row", alignItems: "center",
        backgroundColor: readOnly ? tokens.bg.surfaceMuted : tokens.bg.surface,
        borderWidth: 1, borderColor: tokens.border.default,
        borderRadius: 12, paddingHorizontal: 14,
      }}>
        <Ionicons name={icon} size={18} color={tokens.text.muted} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={tokens.text.placeholder}
          editable={!readOnly && editable}
          style={{
            flex: 1, paddingVertical: 12, paddingLeft: 10,
            fontSize: 14, color: readOnly ? tokens.text.muted : tokens.text.primary,
          }}
        />
        {readOnly ? <Ionicons name="lock-closed" size={14} color={tokens.text.placeholder} /> : null}
      </View>
      {hint ? (
        <Text style={{ fontSize: 11, color: tokens.text.muted, marginTop: 4, marginLeft: 4 }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
