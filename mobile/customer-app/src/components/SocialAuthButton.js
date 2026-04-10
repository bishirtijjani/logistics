import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function SocialAuthButton({ onPress, iconName, text, isLoading, color = '#DB4437' }) {
  return (
    <TouchableOpacity
      className="w-full flex-row items-center justify-center p-4 rounded-full bg-surface-muted border border-surface-muted shadow-sm shadow-black/5 active:scale-95 transition-transform mt-6 mb-4"
      onPress={onPress}
      disabled={isLoading}
    >
      {isLoading ? (
        <ActivityIndicator color="#09090b" />
      ) : (
        <>
          <Ionicons name={iconName} size={24} color={color} style={{ marginRight: 12 }} />
          <Text className="text-secondary font-bold text-lg tracking-wide">{text}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}
