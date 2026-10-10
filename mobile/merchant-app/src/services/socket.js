/**
 * Socket.io client (merchant role).
 *
 * Connects to the API origin with the access token, joins the merchant room
 * (`merchant:room:join { merchantId }` - required; the server does NOT auto-join
 * merchants) and surfaces order/menu/status/chat/wallet/notification events.
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
    this._merchantId = null;
    this._currentRouteName = null;
  }

  setCurrentRouteName(name) {
    this._currentRouteName = name || null;
  }

  async connect(merchantId) {
    if (merchantId) this._merchantId = merchantId;
    if (this.socket?.connected) return;

    try {
      const token = await SecureStore.getItemAsync("accessToken");
      if (!token) return;

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
    } catch (error) {
      console.error("[Socket] Connection error:", error);
    }
  }

  setupEventListeners() {
    if (!this.socket) return;

    this.socket.on("connect", () => {
      this.reconnectAttempts = 0;
      this.joinMerchantRoom(this._merchantId);
      this.emit("connectionStateChange", true);
    });

    this.socket.on("disconnect", () => {
      this.emit("connectionStateChange", false);
    });

    this.socket.on("connect_error", (error) => {
      this.reconnectAttempts++;
      if (this.reconnectAttempts >= this.maxReconnectAttempts) this.disconnect();
      console.warn("[Socket] connect_error:", error?.message);
    });

    // --- Orders ---
    this.socket.on("request:created", (data) => {
      Toast.show({ type: "info", text1: "New order", text2: "A new order just came in" });
      this.emit("requestCreated", data);
    });
    this.socket.on("request:status:changed", (data) => this.emit("requestStatusChanged", data));
    this.socket.on("request:cancelled", (data) => this.emit("requestCancelled", data));
    this.socket.on("request:message:new", (data) => this.emit("requestMessageNew", data));
    this.socket.on("request:rider:location", (data) => this.emit("requestRiderLocation", data));
    this.socket.on("request:rider:eta", (data) => this.emit("requestRiderEta", data));

    // --- Menu / store ---
    this.socket.on("merchant:menu:updated", (data) => this.emit("merchantMenuUpdated", data));
    this.socket.on("merchant:status:changed", (data) => this.emit("merchantStatusChanged", data));

    // --- Wallet ---
    this.socket.on("wallet:balance:updated", (data) => this.emit("walletBalanceUpdated", data));
    this.socket.on("wallet:transfer:received", (data) => this.emit("walletTransferReceived", data));

    // --- Notifications ---
    this.socket.on("notification:new", (data) => {
      if (this._currentRouteName !== "Notifications") {
        Toast.show({ type: "info", text1: data.title || "Notification", text2: data.body || "" });
      }
      this.emit("notificationNew", data);
    });
  }

  // --- Room management ---
  joinMerchantRoom(merchantId) {
    if (!this.socket?.connected || !merchantId) return;
    this._merchantId = merchantId;
    this.socket.emit("merchant:room:join", { merchantId });
  }

  leaveMerchantRoom(merchantId) {
    if (!this.socket?.connected) return;
    this.socket.emit("merchant:room:leave", { merchantId: merchantId || this._merchantId });
  }

  joinRequestRoom(requestId) {
    if (!this.socket?.connected || !requestId) return;
    this.socket.emit("request:room:join", { requestId });
  }

  leaveRequestRoom(requestId) {
    if (!this.socket?.connected || !requestId) return;
    this.socket.emit("request:room:leave", { requestId });
  }

  // --- Subscription helpers ---
  onRequestCreated(cb)          { return this.on("requestCreated", cb); }
  onRequestStatusChanged(cb)    { return this.on("requestStatusChanged", cb); }
  onRequestCancelled(cb)        { return this.on("requestCancelled", cb); }
  onRequestMessageNew(cb)       { return this.on("requestMessageNew", cb); }
  onRequestRiderLocation(cb)    { return this.on("requestRiderLocation", cb); }
  onRequestRiderEta(cb)         { return this.on("requestRiderEta", cb); }
  onMerchantMenuUpdated(cb)     { return this.on("merchantMenuUpdated", cb); }
  onMerchantStatusChanged(cb)   { return this.on("merchantStatusChanged", cb); }
  onNotificationNew(cb)         { return this.on("notificationNew", cb); }
  onWalletBalanceUpdated(cb)    { return this.on("walletBalanceUpdated", cb); }
  onConnectionStateChange(cb)   { return this.on("connectionStateChange", cb); }

  on(event, callback) {
    if (!this.eventHandlers.has(event)) this.eventHandlers.set(event, new Set());
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
