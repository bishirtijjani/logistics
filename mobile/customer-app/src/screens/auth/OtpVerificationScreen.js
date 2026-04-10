import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  KeyboardAvoidingView, 
  Platform, 
  Keyboard, 
  TouchableWithoutFeedback 
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useDispatch, useSelector } from 'react-redux';
import { verifyOtp, clearError } from '../../store/slices/authSlice';

export default function OtpVerificationScreen({ route, navigation }) {
  const { email } = route.params || {};
  const [code, setCode] = useState('');
  const dispatch = useDispatch();
  const { isLoading } = useSelector((state) => state.auth);

  const handleVerify = async () => {
    if (code.length !== 6) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'OTP must be 6 digits',
      });
      return;
    }
    
    dispatch(clearError());
    const resultAction = await dispatch(verifyOtp({ email, code }));
    
    if (verifyOtp.fulfilled.match(resultAction)) {
      Toast.show({
        type: 'success',
        text1: 'Verified!',
        text2: 'Email verified successfully.',
      });
      // Redirect to Login as default for now, or the next stage in register funnel
      navigation.navigate('Login');
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-background"
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View className="flex-1 justify-center p-6">
          <View className="mb-12">
            <Text className="text-5xl font-black text-secondary tracking-tighter mb-2">Verify{'\n'}Code.</Text>
            <Text className="text-lg text-muted font-medium leading-relaxed">
              We sent a 6-digit secure code to{'\n'}
              <Text className="font-bold text-secondary">{email}</Text>
            </Text>
          </View>

          <View className="mb-10">
            <TextInput
              className="bg-surface-muted text-center p-6 rounded-3xl text-secondary text-4xl font-black tracking-[0.5em] ring-2 border-2 border-transparent focus:border-primary focus:bg-surface transition-all shadow-sm shadow-black/5"
              placeholder="000000"
              placeholderTextColor="#D1D5DB"
              keyboardType="numeric"
              maxLength={6}
              value={code}
              onChangeText={setCode}
              editable={!isLoading}
              autoComplete="one-time-code"
              selectionColor="#EA580C"
              onSubmitEditing={handleVerify}
              returnKeyType="done"
            />
          </View>

          <TouchableOpacity 
            className={`w-full p-5 rounded-full items-center shadow-lg transform transition-transform ${isLoading ? 'bg-primary/70 shadow-none' : 'bg-primary shadow-primary/30 active:scale-95'}`}
            onPress={handleVerify}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white text-lg font-bold tracking-wide">Verify Account</Text>
            )}
          </TouchableOpacity>

          <View className="flex-row justify-center mt-8">
            <Text className="text-muted font-medium text-base">Didn't receive the code? </Text>
            <TouchableOpacity>
              <Text className="text-primary font-bold text-base">Resend SMS</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}
