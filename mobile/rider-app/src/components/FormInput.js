import React, { useState, forwardRef } from "react";
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme";

const FormInput = forwardRef(
  ({ label, icon, error, secureTextEntry, ...props }, ref) => {
    const { tokens } = useTheme();
    const [isFocused, setIsFocused] = useState(false);
    const [isPasswordHidden, setIsPasswordHidden] = useState(secureTextEntry);

    return (
      <View style={{ marginBottom: 20 }}>
        {label && <Text style={{ fontSize: 12, fontWeight: '600', marginBottom: 6, marginLeft: 2, color: tokens.text.muted }}>{label}</Text>}
        <View
          style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: tokens.bg.surface, paddingHorizontal: 16, borderRadius: 12, borderWidth: 2, borderColor: error ? tokens.status.error : isFocused ? tokens.brand.default : tokens.border.default }}
        >
          {icon && (
            <Ionicons
              name={icon}
              size={18}
              color={isFocused ? tokens.brand.default : tokens.border.strong}
              style={{ marginRight: 10 }}
            />
          )}
          <TextInput
            ref={ref}
            style={{ flex: 1, paddingVertical: 16, fontSize: 16, fontWeight: '500', color: tokens.text.primary }}
            placeholderTextColor={tokens.border.strong}
            selectionColor={tokens.brand.default}
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
              style={{ paddingLeft: 12, paddingVertical: 8 }}
            >
              <Ionicons
                name={isPasswordHidden ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={isFocused ? tokens.brand.default : tokens.border.strong}
              />
            </TouchableOpacity>
          )}
        </View>
        {error && <Text style={{ fontSize: 12, marginTop: 6, marginLeft: 2, fontWeight: '500', color: tokens.status.error }}>{error}</Text>}
      </View>
    );
  },
);

export default FormInput;
