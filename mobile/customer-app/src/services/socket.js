/**
 * Socket.io client service — real-time delivery tracking.
 *
 * This service manages the socket connection, authentication,
 * and event handling for the customer app.
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
  }

  /**
   * Initialize and connect to the socket server.
   */
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

  /**
   * Setup socket event listeners.
   */
  setupEventListeners() {
    if (!this.socket) return;

    this.socket.on("connect", () => {
      console.log("[Socket] Connected:", this.socket.id);
      this.reconnectAttempts = 0;

      Toast.show({
        type: "success",
        text1: "Connected",
        text2: "Live tracking enabled",
        visibilityTime: 2000,
      });
    });

    this.socket.on("disconnect", (reason) => {
      console.log("[Socket] Disconnected:", reason);
    });

    this.socket.on("connect_error", (error) => {
      console.error("[Socket] Connection error:", error.message);
      this.reconnectAttempts++;

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.log("[Socket] Max reconnection attempts reached");
        this.disconnect();
      }
    });

    // Listen for wallet updates
    this.socket.on("wallet:balance:updated", (data) => {
      console.log("[Socket] Wallet balance updated:", data);
      this.emit("walletBalanceUpdated", data);
    });

    this.socket.on("wallet:transfer:received", (data) => {
      console.log("[Socket] Transfer received:", data);
      Toast.show({
        type: "success",
        text1: "Money Received! 💸",
        text2: `You received ₦${data.amount?.toLocaleString()}`,
      });
      this.emit("transferReceived", data);
    });

    // Listen for delivery events
    this.socket.on("delivery:status:changed", (data) => {
      console.log("[Socket] Delivery status changed:", data);
      this.emit("deliveryStatusChanged", data);
    });

    this.socket.on("delivery:rider:assigned", (data) => {
      console.log("[Socket] Rider assigned:", data);
      Toast.show({
        type: "info",
        text1: "Rider Found! 🏍️",
        text2: "A rider has accepted your delivery",
      });
      this.emit("riderAssigned", data);
    });

    this.socket.on("delivery:completed", (data) => {
      console.log("[Socket] Delivery completed:", data);
      Toast.show({
        type: "success",
        text1: "Delivery Complete! ✅",
        text2: "Your package has been delivered",
      });
      this.emit("deliveryCompleted", data);
    });

    this.socket.on("delivery:cancelled", (data) => {
      console.log("[Socket] Delivery cancelled:", data);
      Toast.show({
        type: "error",
        text1: "Delivery Cancelled",
        text2: data.reason || "Your delivery has been cancelled",
      });
      this.emit("deliveryCancelled", data);
    });

    // Listen for rider location updates
    this.socket.on("rider:location:broadcast", (data) => {
      this.emit("riderLocationUpdate", data);
    });

    // Generic notifications
    this.socket.on("notification:new", (data) => {
      console.log("[Socket] New notification:", data);
      Toast.show({
        type: "info",
        text1: data.title || "Notification",
        text2: data.body || "",
      });
    });
  }

  /**
   * Join a delivery room for real-time tracking.
   */
  joinDeliveryRoom(orderId) {
    if (!this.socket?.connected) {
      console.log("[Socket] Cannot join room — not connected");
      return;
    }
    this.socket.emit("delivery:room:join", { orderId });
    console.log("[Socket] Joined delivery room:", orderId);
  }

  /**
   * Leave a delivery room.
   */
  leaveDeliveryRoom(orderId) {
    if (!this.socket?.connected) return;
    this.socket.emit("delivery:room:leave", { orderId });
    console.log("[Socket] Left delivery room:", orderId);
  }

  /**
   * Event listener helpers.
   */
  onDeliveryStatusChanged(callback) {
    return this.on("deliveryStatusChanged", callback);
  }

  onRiderLocationUpdate(callback) {
    return this.on("riderLocationUpdate", callback);
  }

  onRiderAssigned(callback) {
    return this.on("riderAssigned", callback);
  }

  onDeliveryCompleted(callback) {
    return this.on("deliveryCompleted", callback);
  }

  onWalletBalanceUpdated(callback) {
    return this.on("walletBalanceUpdated", callback);
  }

  // Request event listeners (NEW - Unified Request Architecture)
  onRequestStatusChanged(callback) {
    return this.on("requestStatusChanged", callback);
  }

  onRequestRiderAssigned(callback) {
    return this.on("requestRiderAssigned", callback);
  }

  onRequestRiderLocation(callback) {
    return this.on("requestRiderLocation", callback);
  }

  onRequestCompleted(callback) {
    return this.on("requestCompleted", callback);
  }

  onRequestCancelled(callback) {
    return this.on("requestCancelled", callback);
  }

  /**
   * Subscribe to an event.
   */
  on(event, callback) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event).add(callback);

    // Return unsubscribe function
    return () => {
      this.eventHandlers.get(event)?.delete(callback);
    };
  }

  /**
   * Emit an event to all subscribers.
   */
  emit(event, data) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[Socket] Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Disconnect from the socket server.
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      console.log("[Socket] Disconnected");
    }
  }

  /**
   * Check if socket is connected.
   */
  isConnected() {
    return this.socket?.connected || false;
  }
}

// Export singleton instance
export default new SocketService();
