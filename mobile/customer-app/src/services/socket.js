/**
 * Socket.io client - real-time request lifecycle, rider location, and wallet events.
 *
 * Phase 2 swap: all `delivery:*` events were retired with the legacy module.
 * The unified Request flow uses `request:*` events; rooms are keyed by requestId.
 */

import { io } from "socket.io-client";
import * as SecureStore from "../lib/storage";
import { SOCKET_URL } from "./api";
import Toast from "react-native-toast-message";

class SocketService {
  constructor() {
    this.socket = null;
    this.eventHandlers = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    // AppNavigator updates this with the current route name so we can
    // suppress redundant toasts (e.g. a notification:new toast while the
    // user is already on the NotificationCenter screen).
    this._currentRouteName = null;
  }

  setCurrentRouteName(name) {
    this._currentRouteName = name || null;
  }

  async connect() {
    if (this.socket?.connected) return;

    try {
      const token = await SecureStore.getItemAsync("accessToken");
      if (!token) {
        console.log("[Socket] No token available, skipping connection");
        return;
      }

      this.socket = io(SOCKET_URL, {
        auth: { token },
        transports: ["websocket"],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      this.setupEventListeners();
      console.log("[Socket] Connecting...");
    } catch (error) {
      console.error("[Socket] Connection error:", error);
    }
  }

  setupEventListeners() {
    if (!this.socket) return;

    this.socket.on("connect", () => {
      console.log("[Socket] Connected:", this.socket.id);
      this.reconnectAttempts = 0;
      this.emit("connectionStateChange", true);
      Toast.show({
        type: "success",
        text1: "Connected",
        text2: "Live tracking enabled",
        visibilityTime: 2000,
      });
    });

    this.socket.on("disconnect", (reason) => {
      console.log("[Socket] Disconnected:", reason);
      this.emit("connectionStateChange", false);
    });

    this.socket.on("connect_error", (error) => {
      console.error("[Socket] Connection error:", error.message);
      this.reconnectAttempts++;
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.disconnect();
      }
    });

    // --- Wallet ---
    this.socket.on("wallet:balance:updated", (data) => this.emit("walletBalanceUpdated", data));
    this.socket.on("wallet:transfer:received", (data) => {
      Toast.show({
        type: "success",
        text1: "Money received",
        text2: `You received ₦${data.amount?.toLocaleString?.() ?? data.amount}`,
      });
      this.emit("walletTransferReceived", data);
    });
    this.socket.on("wallet:funding:received", (data) => {
      Toast.show({
        type: "success",
        text1: "Wallet funded",
        text2: `₦${data.amount?.toLocaleString?.() ?? data.amount} credited to your wallet`,
      });
      this.emit("walletFundingReceived", data);
    });

    // --- Unified Request lifecycle ---
    this.socket.on("request:created", (data) => this.emit("requestCreated", data));

    this.socket.on("request:status:changed", (data) => {
      console.log("[Socket] Request status:", data?.requestId, data?.status);
      this.emit("requestStatusChanged", data);
    });

    this.socket.on("request:merchant:accepted", (data) => {
      Toast.show({ type: "success", text1: "Merchant accepted your order" });
      this.emit("requestMerchantAccepted", data);
    });

    this.socket.on("request:merchant:ready", (data) => {
      this.emit("requestMerchantReady", data);
    });

    this.socket.on("request:rider:assigned", (data) => {
      Toast.show({
        type: "info",
        text1: "Rider found",
        text2: "A rider is on the way",
      });
      this.emit("requestRiderAssigned", data);
    });

    this.socket.on("request:rider:location", (data) => this.emit("requestRiderLocation", data));
    this.socket.on("rider:location:broadcast", (data) => this.emit("requestRiderLocation", data));

    this.socket.on("request:completed", (data) => {
      Toast.show({ type: "success", text1: "Order complete", text2: "Tap to rate" });
      this.emit("requestCompleted", data);
    });

    this.socket.on("request:cancelled", (data) => {
      Toast.show({
        type: "error",
        text1: "Order cancelled",
        text2: data.reason || "Your order has been cancelled",
      });
      this.emit("requestCancelled", data);
    });

    // --- Phase 4 - matching ring status, live ETA, in-app chat ---
    this.socket.on("request:matching:status", (data) => {
      this.emit("requestMatchingStatus", data);
    });

    this.socket.on("request:rider:eta", (data) => {
      this.emit("requestRiderEta", data);
    });

    this.socket.on("request:message:new", (data) => {
      this.emit("requestMessageNew", data);
    });

    // --- Merchant catalogue (86 propagation) ---
    this.socket.on("merchant:menu:updated", (data) => this.emit("merchantMenuUpdated", data));

    // --- Merchant open/closed status (broadcast to all clients, no room join needed) ---
    this.socket.on("merchant:status:changed", (data) => this.emit("merchantStatusChanged", data));

    // --- Generic notifications ---
    this.socket.on("notification:new", (data) => {
      // Suppress the toast if the user is already on the Notification Center
      // (they'll see the row prepend instead) - avoids a redundant toast +
      // list-row pair on the same event.
      if (this._currentRouteName !== "NotificationCenter") {
        Toast.show({
          type: "info",
          text1: data.title || "Notification",
          text2: data.body || "",
        });
      }
      this.emit("notificationNew", data);
    });
  }

  // --- Room management ---

  joinRequestRoom(requestId) {
    if (!this.socket?.connected || !requestId) return;
    this.socket.emit("request:room:join", { requestId });
  }

  leaveRequestRoom(requestId) {
    if (!this.socket?.connected || !requestId) return;
    this.socket.emit("request:room:leave", { requestId });
  }

  joinMerchantRoom(merchantId) {
    if (!this.socket?.connected || !merchantId) return;
    this.socket.emit("merchant:room:join", { merchantId });
  }

  leaveMerchantRoom(merchantId) {
    if (!this.socket?.connected || !merchantId) return;
    this.socket.emit("merchant:room:leave", { merchantId });
  }

  // --- Subscription helpers ---

  onRequestStatusChanged(cb)      { return this.on("requestStatusChanged", cb); }
  onRequestRiderAssigned(cb)      { return this.on("requestRiderAssigned", cb); }
  onRequestRiderLocation(cb)      { return this.on("requestRiderLocation", cb); }
  onRequestMerchantAccepted(cb)   { return this.on("requestMerchantAccepted", cb); }
  onRequestMerchantReady(cb)      { return this.on("requestMerchantReady", cb); }
  onRequestCompleted(cb)          { return this.on("requestCompleted", cb); }
  onRequestCancelled(cb)          { return this.on("requestCancelled", cb); }
  onRequestMatchingStatus(cb)     { return this.on("requestMatchingStatus", cb); }
  onRequestRiderEta(cb)           { return this.on("requestRiderEta", cb); }
  onRequestMessageNew(cb)         { return this.on("requestMessageNew", cb); }
  onNotificationNew(cb)           { return this.on("notificationNew", cb); }
  onWalletBalanceUpdated(cb)      { return this.on("walletBalanceUpdated", cb); }
  onWalletTransferReceived(cb)    { return this.on("walletTransferReceived", cb); }
  onWalletFundingReceived(cb)     { return this.on("walletFundingReceived", cb); }
  onMerchantMenuUpdated(cb)       { return this.on("merchantMenuUpdated", cb); }
  onMerchantStatusChanged(cb)     { return this.on("merchantStatusChanged", cb); }

  // Phase 5 - expose the socket's connect/disconnect state for the
  // connection-quality banner. Listeners receive `true` on connect and
  // `false` on disconnect.
  onConnectionStateChange(cb) {
    return this.on("connectionStateChange", cb);
  }

  // Expose room re-join helpers used by AppState foreground resync.
  rejoinRequestRoomIfActive(activeRequestId) {
    if (!this.socket?.connected || !activeRequestId) return;
    this.socket.emit("request:room:join", { requestId: activeRequestId });
  }

  on(event, callback) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event).add(callback);
    return () => this.eventHandlers.get(event)?.delete(callback);
  }

  emit(event, data) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((cb) => {
        try { cb(data); } catch (err) { console.error("[Socket]", event, err); }
      });
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  isConnected() {
    return this.socket?.connected || false;
  }
}

export default new SocketService();
