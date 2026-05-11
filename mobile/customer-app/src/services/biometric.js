import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const BIOMETRIC_ENABLED_KEY = 'biometricEnabled';

export const isBiometricAvailable = async () => {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return false;
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  return isEnrolled;
};

export const isBiometricEnabled = async () => {
  const value = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
  return value === 'true';
};

export const setBiometricEnabled = async (enabled) => {
  await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, enabled ? 'true' : 'false');
};

/**
 * Prompt the user for biometric authentication.
 * Returns true if authenticated, false otherwise.
 */
export const authenticateWithBiometric = async (promptMessage = 'Authenticate to continue') => {
  const available = await isBiometricAvailable();
  if (!available) return false;

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    fallbackLabel: 'Use PIN instead',
    disableDeviceFallback: false,
  });

  return result.success;
};
