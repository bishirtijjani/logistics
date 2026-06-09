/**
 * Bridges the socket → Redux store for `notification:new` events.
 * Subscribed once at the AppNavigator level when the user is authenticated.
 */

import socketService from './socket';

let lastUnsubscribe = null;

export const subscribeSocketToStore = (dispatch, { notificationReceived }) => {
  // Idempotent - re-subscribing replaces the previous handler.
  if (typeof lastUnsubscribe === 'function') {
    lastUnsubscribe();
    lastUnsubscribe = null;
  }
  lastUnsubscribe = socketService.onNotificationNew((data) => {
    dispatch(notificationReceived(data));
  });
  return () => {
    if (typeof lastUnsubscribe === 'function') {
      lastUnsubscribe();
      lastUnsubscribe = null;
    }
  };
};
