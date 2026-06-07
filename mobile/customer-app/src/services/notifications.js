import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import api from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Request notification permissions and register the FCM/APNs token with our backend.
 * Safe to call multiple times — no-ops if permission denied.
 */
export const registerPushToken = async () => {
  // On web there's no FCM/APNs — register a browser Push subscription instead.
  // Dynamic import so the web-only module never loads into the native bundle.
  if (Platform.OS === 'web') {
    try {
      const { registerWebPush } = await import('./webPush');
      return await registerWebPush();
    } catch (error) {
      console.warn('[Notifications] web push registration failed:', error?.message);
      return null;
    }
  }
  if (!Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#EA580C',
    });
  }

  try {
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    await api.post('/auth/fcm-token', { fcmToken: token });
    return token;
  } catch (error) {
    console.warn('[Notifications] Token registration failed:', error.message);
    return null;
  }
};
