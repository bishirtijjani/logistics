import React, { useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ActivityIndicator, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform, 
  Keyboard, 
  TouchableWithoutFeedback 
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useDispatch, useSelector } from 'react-redux';
import { register, loginWithGoogle, clearError } from '../../store/slices/authSlice';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import FormInput from '../../components/FormInput';
import SocialAuthButton from '../../components/SocialAuthButton';

WebBrowser.maybeCompleteAuthSession();

const registerSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export default function RegisterScreen({ navigation }) {
  const dispatch = useDispatch();
  const { isLoading } = useSelector((state) => state.auth);

  // Focus Refs for Keyboard Navigation
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: '1001895940462-lbs6fcgm1cn4fj2hhrjotltcjq6mebai.apps.googleusercontent.com',
    iosClientId: '1001895940462-7urrks74vpq96kjgarrf5dj92odjr67a.apps.googleusercontent.com',
    androidClientId: '1001895940462-h88c8hi8r4guiu05j4dqki52poufuspk.apps.googleusercontent.com',
  });

  const { control, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '' }
  });

  React.useEffect(() => {
    if (response?.type === 'success') {
      const { idToken } = response.authentication;
      if (idToken) {
        dispatch(loginWithGoogle(idToken))
          .unwrap()
          .then(() => {
            Toast.show({ type: 'success', text1: 'Google Auth Successful!' });
          })
          .catch((err) => {
            Toast.show({ type: 'error', text1: 'Auth Failed', text2: err });
          });
      }
    }
  }, [response, dispatch]);

  const onSubmit = async (data) => {
    dispatch(clearError());
    const resultAction = await dispatch(register({ 
      ...data,
      role: 'CUSTOMER' 
    }));
    
    if (register.fulfilled.match(resultAction)) {
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Check your email for the OTP!',
      });
      navigation.navigate('OtpVerification', { email: data.email });
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView 
          className="flex-1 bg-background" 
          contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 60 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-10">
            <Text className="text-5xl font-black text-secondary tracking-tighter mb-2">Create{'\n'}account.</Text>
            <Text className="text-lg text-muted font-medium">Join thousands of users moving fast.</Text>
          </View>

          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, onBlur, value } }) => (
              <FormInput
                label="Full Name"
                icon="person-outline"
                placeholder="e.g. John Doe"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={errors.name?.message}
                editable={!isLoading}
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
              />
            )}
          />

          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <FormInput
                ref={emailRef}
                label="Email Address"
                icon="mail-outline"
                placeholder="john@logistics.com"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={errors.email?.message}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isLoading}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <FormInput
                ref={passwordRef}
                label="Security Password"
                icon="lock-closed-outline"
                placeholder="Create a strong password"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={errors.password?.message}
                secureTextEntry
                editable={!isLoading}
                returnKeyType="join"
                onSubmitEditing={handleSubmit(onSubmit)}
              />
            )}
          />

          <TouchableOpacity
            className={`w-full p-5 rounded-full items-center shadow-lg transform transition-transform ${isLoading ? 'bg-primary/70 shadow-none' : 'bg-primary shadow-primary/30 active:scale-95'}`}
            onPress={handleSubmit(onSubmit)}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white text-lg font-bold tracking-wide">Join Platform</Text>
            )}
          </TouchableOpacity>

          <View className="flex-row items-center mt-6 mb-2">
            <View className="flex-1 h-[1px] bg-surface-muted" />
            <Text className="mx-4 text-muted font-medium">OR</Text>
            <View className="flex-1 h-[1px] bg-surface-muted" />
          </View>

          <SocialAuthButton 
            text="Continue with Google" 
            iconName="logo-google" 
            onPress={() => promptAsync()} 
            isLoading={!request}
          />

          <View className="flex-row justify-center mt-4 mb-4">
            <Text className="text-muted font-medium text-base">Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text className="text-primary font-bold text-base">Log in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}
