import React, { useState, forwardRef } from "react";
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";

const FormInput = forwardRef(
  ({ label, icon, error, secureTextEntry, ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    const [isPasswordHidden, setIsPasswordHidden] = useState(secureTextEntry);

    return (
      <View style={styles.wrapper}>
        {label && <Text style={styles.label}>{label}</Text>}
        <View
          style={[
            styles.inputRow,
            error
              ? styles.inputError
              : isFocused
                ? styles.inputFocused
                : styles.inputDefault,
          ]}
        >
          {icon && (
            <Ionicons
              name={icon}
              size={18}
              color={isFocused ? colors.primary : "#D1D5DB"}
              style={{ marginRight: 10 }}
            />
          )}
          <TextInput
            ref={ref}
            style={styles.input}
            placeholderTextColor="#D1D5DB"
            selectionColor={colors.primary}
            secureTextEntry={isPasswordHidden}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus && props.onFocus(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur && props.onBlur(e);
            }}
            {...props}
          />
          {secureTextEntry !== undefined && (
            <TouchableOpacity
              onPress={() => setIsPasswordHidden(!isPasswordHidden)}
              style={styles.eyeBtn}
            >
              <Ionicons
                name={isPasswordHidden ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={isFocused ? colors.primary : "#D1D5DB"}
              />
            </TouchableOpacity>
          )}
        </View>
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  wrapper: { marginBottom: 20 },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    marginLeft: 2,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  inputDefault: { borderColor: colors.border },
  inputFocused: { borderColor: colors.primary },
  inputError: { borderColor: colors.error },
  input: {
    flex: 1,
    paddingVertical: 16,
    color: colors.text,
    fontSize: 15,
    fontWeight: "500",
  },
  eyeBtn: { paddingLeft: 12, paddingVertical: 8 },
  errorText: {
    color: colors.error,
    fontSize: 12,
    marginTop: 6,
    marginLeft: 2,
    fontWeight: "500",
  },
});

export default FormInput;
