import React, { useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ActivityIndicator, 
  KeyboardAvoidingView, 
  Platform, 
  Keyboard, 
  TouchableWithoutFeedback 
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useDispatch, useSelector } from 'react-redux';
import { login, loginWithGoogle, clearError } from '../../store/slices/authSlice';
import { useForm, Controller } from 'react-hook-form';
import FormInput from '../../components/FormInput';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import SocialAuthButton from '../../components/SocialAuthButton';

WebBrowser.maybeCompleteAuthSession();

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

const LAST_EMAIL_KEY = 'vtu_last_email';

export default function LoginScreen({ navigation }) {
  const dispatch = useDispatch();
  const { isLoading } = useSelector((state) => state.auth);
  const passwordRef = useRef(null);

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: '1001895940462-lbs6fcgm1cn4fj2hhrjotltcjq6mebai.apps.googleusercontent.com',
    iosClientId: '1001895940462-7urrks74vpq96kjgarrf5dj92odjr67a.apps.googleusercontent.com',
    androidClientId: '1001895940462-h88c8hi8r4guiu05j4dqki52poufuspk.apps.googleusercontent.com',
  });

  const { control, handleSubmit, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' }
  });

  // Load last used email on mount
  useEffect(() => {
    const loadLastEmail = async () => {
      try {
        const savedEmail = await AsyncStorage.getItem(LAST_EMAIL_KEY);
        if (savedEmail) {
          setValue('email', savedEmail);
        }
      } catch (e) {
        console.error('Failed to load email', e);
      }
    };
    loadLastEmail();
  }, [setValue]);

  useEffect(() => {
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
    const resultAction = await dispatch(login(data));
    
    if (login.fulfilled.match(resultAction)) {
      // Remember email on success
      await AsyncStorage.setItem(LAST_EMAIL_KEY, data.email);
      Toast.show({ type: 'success', text1: 'Welcome back!' });
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
            <Text className="text-5xl font-black text-secondary tracking-tighter mb-2">Welcome{'\n'}back.</Text>
            <Text className="text-lg text-muted font-medium">Log in to manage your deliveries.</Text>
          </View>

          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <FormInput
                label="Email Address"
                icon="mail-outline"
                placeholder="e.g. john@logistics.com"
                error={errors.email?.message}
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
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
              <View>
                <FormInput
                  ref={passwordRef}
                  label="Security Password"
                  icon="lock-closed-outline"
                  placeholder="Enter your security password"
                  error={errors.password?.message}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  secureTextEntry
                  editable={!isLoading}
                  returnKeyType="go"
                  onSubmitEditing={handleSubmit(onSubmit)}
                />
                <TouchableOpacity className="absolute right-2 top-0 mt-2">
                  <Text className="text-primary font-bold text-sm">Forgot?</Text>
                </TouchableOpacity>
              </View>
            )}
          />

          <TouchableOpacity
            className={`w-full p-5 mt-4 rounded-full items-center shadow-lg transform transition-transform ${isLoading ? 'bg-primary/70 shadow-none' : 'bg-primary shadow-primary/30 active:scale-95'}`}
            onPress={handleSubmit(onSubmit)}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white text-lg font-bold tracking-wide">Continue</Text>
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

          <View className="flex-row justify-center mt-4">
            <Text className="text-muted font-medium text-base">New to our platform? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text className="text-primary font-bold text-base">Create account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

