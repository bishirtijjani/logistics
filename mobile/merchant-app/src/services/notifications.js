import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import api from './api';

/**
 * Notification categories with action buttons. New orders surface inline
 * "Accept" / "Reject" actions so a merchant can act straight from the tray -
 * a headline native capability (and a strong App Store 4.2 signal).
 */
export const ORDER_CATEGORY = 'merchant-order';
export const ACTION_ACCEPT = 'ORDER_ACCEPT';
export const ACTION_REJECT = 'ORDER_REJECT';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const configureNotificationCategories = async () => {
  try {
    await Notifications.setNotificationCategoryAsync(ORDER_CATEGORY, [
      {
        identifier: ACTION_ACCEPT,
        buttonTitle: 'Accept',
        options: { opensAppToForeground: true },
      },
      {
        identifier: ACTION_REJECT,
        buttonTitle: 'Reject',
        options: { isDestructive: true, opensAppToForeground: true },
      },
    ]);
  } catch (error) {
    console.warn('[Notifications] category setup failed:', error?.message);
  }
};

/**
 * Android channels for the merchant role.
 *   - default          : generic (low importance)
 *   - merchant-orders  : new orders (MAX + sound + bypass DND - time-critical)
 *   - merchant-status  : order status changes (high, no sound)
 *   - wallet           : earnings & withdrawals
 *   - support          : support / dispute replies
 */
const configureAndroidChannels = async () => {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: '#EA580C',
  });
  await Notifications.setNotificationChannelAsync('merchant-orders', {
    name: 'New orders',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 400, 200, 400, 200, 400],
    lightColor: '#EA580C',
    bypassDnd: true,
  });
  await Notifications.setNotificationChannelAsync('merchant-status', {
    name: 'Order updates',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200],
    lightColor: '#EA580C',
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
 * Request permission and register the native push token with the backend
 * (`POST /auth/fcm-token`). The backend already pushes `type:'ORDER'`
 * "New order received" to the merchant's user on order creation.
 * Safe to call repeatedly - no-ops when permission is denied.
 */
export const registerPushToken = async () => {
  if (!Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  await configureAndroidChannels();
  await configureNotificationCategories();

  try {
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    await api.post('/auth/fcm-token', { fcmToken: token }, { suppressErrorToast: true });
    return token;
  } catch (error) {
    console.warn('[Notifications] Token registration failed:', error.message);
    return null;
  }
};
