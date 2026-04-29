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
      <View className="mb-5">
        {label && <Text className="text-xs font-semibold mb-1.5 ml-0.5" style={{ color: colors.textMuted }}>{label}</Text>}
        <View
          className={`flex-row items-center bg-white px-4 rounded-xl border-2 ${error ? 'border-red-500' : isFocused ? 'border-orange-600' : 'border-gray-200'}`}
        >
          {icon && (
            <Ionicons
              name={icon}
              size={18}
              color={isFocused ? colors.primary : "#D1D5DB"}
              className="mr-2.5"
            />
          )}
          <TextInput
            ref={ref}
            className="flex-1 py-4 text-base font-medium"
            style={{ color: colors.text }}
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
              className="pl-3 py-2"
            >
              <Ionicons
                name={isPasswordHidden ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={isFocused ? colors.primary : "#D1D5DB"}
              />
            </TouchableOpacity>
          )}
        </View>
        {error && <Text className="text-xs mt-1.5 ml-0.5 font-medium" style={{ color: colors.error }}>{error}</Text>}
      </View>
    );
  },
);

export default FormInput;
