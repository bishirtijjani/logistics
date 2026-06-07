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
 * Configure Android notification channels for the rider role.
 *   - `default`            : generic system notifications (low importance).
 *   - `rider-offer`        : incoming job offers (max importance + sound + vibration).
 *   - `rider-trip`         : active-trip status changes (high importance, no sound).
 *   - `rider-online`       : foreground-service "You're online" persistent notif (low).
 *   - `wallet`             : earnings & withdrawal events (default importance).
 *   - `support`            : support / dispute replies (default importance).
 */
const configureAndroidChannels = async () => {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#EA580C',
  });
  await Notifications.setNotificationChannelAsync('rider-offer', {
    name: 'Job offers',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 400, 200, 400, 200, 400],
    lightColor: '#EA580C',
    // Pierce Do Not Disturb on Android — offers are time-critical (60 s window).
    // Riders who don't want this can disable the channel from system settings.
    bypassDnd: true,
  });
  await Notifications.setNotificationChannelAsync('rider-trip', {
    name: 'Active trip',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200],
    lightColor: '#EA580C',
  });
  await Notifications.setNotificationChannelAsync('rider-online', {
    name: 'You are online',
    importance: Notifications.AndroidImportance.LOW,
    lightColor: '#EA580C',
    enableVibrate: false,
  });
  await Notifications.setNotificationChannelAsync('wallet', {
    name: 'Wallet & earnings',
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: '#10B981',
  });
  await Notifications.setNotificationChannelAsync('support', {
    name: 'Support',
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: '#0EA5E9',
  });
};

/**
 * Request notification permissions and register the FCM/APNs token with our backend.
 * Safe to call multiple times — no-ops if permission denied.
 */
export const registerPushToken = async () => {
  // Push tokens require FCM/APNs, which aren't available in a browser. The web
  // build receives realtime updates over socket.io instead, so skip cleanly.
  if (Platform.OS === 'web') return null;
  if (!Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  await configureAndroidChannels();

  try {
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    // Best-effort: opt out of the global error toast. This fires right after
    // the rider grants notification permission — a failed registration should
    // retry silently next launch, not surface "Something went wrong".
    await api.post('/auth/fcm-token', { fcmToken: token }, { suppressErrorToast: true });
    return token;
  } catch (error) {
    console.warn('[Notifications] Token registration failed:', error.message);
    return null;
  }
};
