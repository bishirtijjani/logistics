/**
 * Socket.io client (rider role) — receives job offers, broadcasts location,
 * receives request lifecycle + wallet + notification events.
 *
 * Differences from customer socket:
 *   - Listens to `rider:job:new`, `rider:job:confirmed`, `rider:job:taken`.
 *   - Exposes emit helpers for `rider:availability:changed`,
 *     `rider:location:update`, `rider:job:accept`, `rider:job:reject`.
 *   - Drops customer-only events (merchant catalogue updates, request:merchant:accepted).
 *   - Toasts are rider-flavoured copy.
 */

import { io } from "socket.io-client";
import * as SecureStore from "expo-secure-store";
import { SOCKET_URL } from "./api";
import Toast from "react-native-toast-message";

class SocketService {
  constructor() {
    this.socket = null;
    this.eventHandlers = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
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

    // --- Rider job offers ---
    this.socket.on("rider:job:new", (data) => {
      console.log("[Socket] New job offer:", data?.requestId);
      this.emit("riderJobNew", data);
    });

    this.socket.on("rider:job:confirmed", (data) => {
      console.log("[Socket] Job confirmed:", data?.requestId);
      this.emit("riderJobConfirmed", data);
    });

    this.socket.on("rider:job:taken", (data) => {
      this.emit("riderJobTaken", data);
    });

    // --- Unified Request lifecycle (rider listens as a party to the request room) ---
    this.socket.on("request:status:changed", (data) => {
      console.log("[Socket] Request status:", data?.requestId, data?.status);
      this.emit("requestStatusChanged", data);
    });

    this.socket.on("request:rider:assigned", (data) => this.emit("requestRiderAssigned", data));

    this.socket.on("request:completed", (data) => {
      Toast.show({ type: "success", text1: "Delivery complete", text2: "Earnings on the way" });
      this.emit("requestCompleted", data);
    });

    this.socket.on("request:cancelled", (data) => {
      Toast.show({
        type: "error",
        text1: "Trip cancelled",
        text2: data?.reason || "This delivery was cancelled",
      });
      this.emit("requestCancelled", data);
    });

    this.socket.on("request:message:new", (data) => this.emit("requestMessageNew", data));

    // --- Generic notifications ---
    this.socket.on("notification:new", (data) => {
      if (this._currentRouteName !== "NotificationsCenter") {
        Toast.show({
          type: "info",
          text1: data.title || "Notification",
          text2: data.body || "",
        });
      }
      this.emit("notificationNew", data);
    });
  }

  // --- Emit helpers (client → server) ---

  emitAvailabilityChanged(availability) {
    if (!this.socket?.connected) return;
    this.socket.emit("rider:availability:changed", { availability });
  }

  emitLocationUpdate({ lat, lng, requestId }) {
    if (!this.socket?.connected) return;
    this.socket.emit("rider:location:update", { lat, lng, requestId });
  }

  emitJobAccept(requestId) {
    if (!this.socket?.connected || !requestId) return;
    this.socket.emit("rider:job:accept", { requestId });
  }

  emitJobReject(requestId) {
    if (!this.socket?.connected || !requestId) return;
    this.socket.emit("rider:job:reject", { requestId });
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

  rejoinRequestRoomIfActive(activeRequestId) {
    if (!this.socket?.connected || !activeRequestId) return;
    this.socket.emit("request:room:join", { requestId: activeRequestId });
  }

  // --- Subscription helpers ---

  onRiderJobNew(cb)               { return this.on("riderJobNew", cb); }
  onRiderJobConfirmed(cb)         { return this.on("riderJobConfirmed", cb); }
  onRiderJobTaken(cb)             { return this.on("riderJobTaken", cb); }
  onRequestStatusChanged(cb)      { return this.on("requestStatusChanged", cb); }
  onRequestRiderAssigned(cb)      { return this.on("requestRiderAssigned", cb); }
  onRequestCompleted(cb)          { return this.on("requestCompleted", cb); }
  onRequestCancelled(cb)          { return this.on("requestCancelled", cb); }
  onRequestMessageNew(cb)         { return this.on("requestMessageNew", cb); }
  onNotificationNew(cb)           { return this.on("notificationNew", cb); }
  onWalletBalanceUpdated(cb)      { return this.on("walletBalanceUpdated", cb); }
  onWalletTransferReceived(cb)    { return this.on("walletTransferReceived", cb); }
  onWalletFundingReceived(cb)     { return this.on("walletFundingReceived", cb); }

  onConnectionStateChange(cb) {
    return this.on("connectionStateChange", cb);
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
