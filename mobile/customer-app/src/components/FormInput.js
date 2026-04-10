import React, { useState, forwardRef } from 'react';
import { View, TextInput, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const FormInput = forwardRef(({ label, icon, error, ...props }, ref) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View className="mb-6">
      {label && <Text className="text-secondary font-bold mb-2 ml-1 text-sm uppercase tracking-wider">{label}</Text>}
      <View 
        className={`flex-row items-center bg-surface-muted px-4 rounded-2xl border-2 ${
          isFocused ? 'border-primary bg-surface' : 'border-transparent'
        } ${error ? 'border-error bg-error/5' : ''}`}
      >
        {icon && (
          <Ionicons 
            name={icon} 
            size={22} 
            color={isFocused ? '#EA580C' : '#9CA3AF'} 
            style={{ marginRight: 12 }}
          />
        )}
        <TextInput
          ref={ref}
          className="flex-1 py-4 text-secondary text-lg font-semibold"
          placeholderTextColor="#9CA3AF"
          selectionColor="#EA580C"
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
      </View>
      {error && <Text className="text-error text-sm mt-2 ml-2 font-medium">{error}</Text>}
    </View>
  );
});

export default FormInput;
