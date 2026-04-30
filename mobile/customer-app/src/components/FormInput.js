import React, { useState, forwardRef } from "react";
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";

const FormInput = forwardRef(
  ({ label, icon, error, secureTextEntry, ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    const [isPasswordHidden, setIsPasswordHidden] = useState(secureTextEntry);

    return (
      <View style={{ marginBottom: 20 }}>
        {label && <Text style={{ fontSize: 12, fontWeight: '600', marginBottom: 6, marginLeft: 2, color: colors.textMuted }}>{label}</Text>}
        <View
          style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 16, borderRadius: 12, borderWidth: 2, borderColor: error ? '#EF4444' : isFocused ? '#EA580C' : '#E5E7EB' }}
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
            style={{ flex: 1, paddingVertical: 16, fontSize: 16, fontWeight: '500', color: colors.text }}
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
              style={{ paddingLeft: 12, paddingVertical: 8 }}
            >
              <Ionicons
                name={isPasswordHidden ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={isFocused ? colors.primary : "#D1D5DB"}
              />
            </TouchableOpacity>
          )}
        </View>
        {error && <Text style={{ fontSize: 12, marginTop: 6, marginLeft: 2, fontWeight: '500', color: colors.error }}>{error}</Text>}
      </View>
    );
  },
);

export default FormInput;
