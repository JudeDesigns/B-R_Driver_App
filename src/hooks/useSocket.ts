"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { SocketEvents } from "@/lib/socketClient";
import { optimizeSocketHandler } from "@/lib/performance";
import { tokenManager } from "@/lib/tokenRefresh";

interface UseSocketOptions {
  autoConnect?: boolean;
  token?: string | null;
}

export const useSocket = (
  optionsOrToken: UseSocketOptions | string | null = {}
) => {
  // Handle both options object and direct token string
  let options: UseSocketOptions;

  if (typeof optionsOrToken === "string" || optionsOrToken === null) {
    options = { token: optionsOrToken, autoConnect: true };
  } else {
    options = optionsOrToken;
  }

  const { autoConnect = true, token: providedToken = null } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Initialize socket connection
  useEffect(() => {
    if (!autoConnect) return;

    // Use provided token or get from localStorage/sessionStorage
    let token = providedToken;
    let userRole = null;
    let userId = null;
    let username = null;

    if (!token && typeof window !== "undefined") {
      // Check both storage types if token not provided
      // First check localStorage
      token = localStorage.getItem("token");
      userRole = localStorage.getItem("userRole");
      userId = localStorage.getItem("userId");
      username = localStorage.getItem("username");

      // If not found in localStorage, check sessionStorage
      if (!token) {
        token = sessionStorage.getItem("token");
        userRole = sessionStorage.getItem("userRole");
        userId = sessionStorage.getItem("userId");
        username = sessionStorage.getItem("username");
      }

      // If token is expired or expiring soon, try to refresh it
      if (token && tokenManager.isTokenExpiringSoon(token)) {
        console.log("WebSocket: Token is expiring soon, attempting refresh");
        tokenManager.refreshToken().then((newToken) => {
          if (newToken && socketRef.current) {
            // Reconnect with new token
            socketRef.current.auth = {
              token: newToken,
              role: userRole,
              id: userId,
              username: username
            };
            socketRef.current.connect();
          }
        }).catch((error) => {
          console.log("WebSocket: Token refresh failed", error);
        });
      }
    }

    if (!token) {
      // Don't show error popup for missing token - just silently fail
      // This prevents annoying popups on different phones or expired sessions
      console.log("No authentication token found for WebSocket connection");
      setIsConnected(false);
      return;
    }

    // Create socket connection to the Socket.IO server on the same port as the app
    const socketServerUrl =
      typeof window !== "undefined" ? window.location.origin : "";

    // Only log in development mode
    if (process.env.NODE_ENV !== "production") {
      console.log("Auth info:", { token: "***", userRole, userId, username });
    }

    // Create an optimized Socket.IO connection with performance enhancements
    const socket = io(socketServerUrl, {
      path: "/socket.io",
      auth: {
        token,
        role: userRole,
        id: userId,
        username: username,
      },
      // Optimize transport configuration for better performance
      // Use WebSocket first for faster connection if available, fallback to polling
      transports: ["websocket", "polling"],
      // Optimize reconnection settings for better reliability
      reconnection: true,
      reconnectionAttempts: 5, // Reduced to improve performance
      reconnectionDelay: 1000,
      reconnectionDelayMax: 3000, // Reduced for faster reconnection
      randomizationFactor: 0.3, // Reduced for more predictable reconnection
      // Optimize timeout settings for better performance
      timeout: 10000, // Reduced for faster timeout detection
      // Enable auto-connect
      autoConnect: true,
      // Optimize buffer size and memory usage
      rememberUpgrade: true,
      // Avoid reusing problematic connections
      forceNew: true,
      // Additional performance optimizations
      upgrade: true, // Enable transport upgrades
      // Removed other options due to type compatibility issues
    });

    // Simple, focused event handlers for reliability

    // Connection events - optimized with reduced logging
    socket.on(SocketEvents.CONNECT, () => {
      if (process.env.NODE_ENV !== "production") {
        console.log("Socket connected successfully");
      }
      setIsConnected(true);
      setError(null);
    });

    socket.on(SocketEvents.DISCONNECT, (reason) => {
      if (process.env.NODE_ENV !== "production") {
        console.log(`Socket disconnected: ${reason}`);
      }
      setIsConnected(false);
    });

    socket.on(SocketEvents.CONNECT_ERROR, (err: Error) => {
      if (process.env.NODE_ENV !== "production") {
        console.error("Socket connection error:", err);
      }

      // Check if the error is related to authentication
      if (err.message.includes("authentication") || err.message.includes("token") || err.message.includes("Unauthorized")) {
        // Authentication error - don't show popup, just log
        console.log("WebSocket authentication failed - user may need to re-login");
        // Don't set error state to avoid annoying popup
      } else if (err.message.includes("websocket")) {
        // WebSocket specific error
        setError(
          `WebSocket connection error: ${err.message}. Trying to reconnect...`
        );
      } else {
        // Other connection errors
        setError(`Connection error: ${err.message}. Trying to reconnect...`);
      }

      // We'll clear this error if reconnection succeeds
      setIsConnected(false);

      // Try to reconnect with polling transport if WebSocket fails
      if (err.message.includes("websocket")) {
        try {
          // Force reconnect with polling transport
          socket.io.opts.transports = ["polling"];
          socket.connect();
        } catch (reconnectError) {
          console.error("Error during reconnection attempt:", reconnectError);
        }
      }
    });

    // Enhanced reconnection handling
    socket.io.on("reconnect", (attemptNumber: number) => {
      if (process.env.NODE_ENV !== "production") {
        console.log(`Socket reconnected after ${attemptNumber} attempts`);
      }
      setError(null);

      // Reset transports to match server configuration
      socket.io.opts.transports = ["polling", "websocket"];
    });

    socket.io.on("reconnect_attempt", (attemptNumber: number) => {
      if (process.env.NODE_ENV !== "production") {
        console.log(`Socket reconnection attempt #${attemptNumber}`);
      }

      // Update error message to show reconnection attempt
      setError(`Connection error - reconnection attempt #${attemptNumber}...`);
    });

    socket.io.on("reconnect_failed", () => {
      if (process.env.NODE_ENV !== "production") {
        console.error("Socket reconnection failed after all attempts");
      }
      setError("Connection lost - please click Reconnect or refresh the page");
    });

    // Add error event handler
    socket.on("error", (err: Error) => {
      console.error("Socket error:", err);
      setError(`Socket error: ${err.message}`);
    });

    // Store socket reference
    socketRef.current = socket;

    // Get a reference to the current joinedRoomsRef for cleanup
    const currentJoinedRoomsRef = joinedRoomsRef;

    // Clean up on unmount
    return () => {
      if (socket) {
        socket.disconnect();
        socketRef.current = null;

        // Clear joined rooms set on cleanup using the captured reference
        currentJoinedRoomsRef.current.clear();
      }
    };
  }, [autoConnect, providedToken]);

  // Keep track of joined rooms to prevent duplicate join events
  const joinedRoomsRef = useRef<Set<string>>(new Set());

  // Join a room
  const joinRoom = useCallback(
    (room: string) => {
      if (!socketRef.current || !isConnected) return;

      // Check if already joined to prevent duplicate join events
      if (joinedRoomsRef.current.has(room)) {
        return;
      }

      // Add to joined rooms set
      joinedRoomsRef.current.add(room);

      if (room.startsWith("route:")) {
        socketRef.current.emit(
          SocketEvents.JOIN_ROUTE_ROOM,
          room.replace("route:", "")
        );
      } else if (room.startsWith("driver:")) {
        socketRef.current.emit(
          SocketEvents.JOIN_DRIVER_ROOM,
          room.replace("driver:", "")
        );
      } else if (room === "admin") {
        socketRef.current.emit(SocketEvents.JOIN_ADMIN_ROOM);
      }
    },
    [isConnected]
  );

  // Leave a room
  const leaveRoom = useCallback(
    (room: string) => {
      if (!socketRef.current || !isConnected) return;
      socketRef.current.emit(SocketEvents.LEAVE_ROOM, room);

      // Remove from joined rooms set
      joinedRoomsRef.current.delete(room);
    },
    [isConnected]
  );

  // Subscribe to an event with optimization to prevent unnecessary re-renders
  const subscribe = useCallback(
    <T>(event: string, callback: (data: T) => void) => {
      if (!socketRef.current) return () => {};

      // Optimize the callback to prevent unnecessary re-renders
      const optimizedCallback = optimizeSocketHandler<T>(callback);

      // Use the optimized callback for the socket event
      socketRef.current.on(event, optimizedCallback);

      return () => {
        if (socketRef.current) {
          socketRef.current.off(event, optimizedCallback);
        }
      };
    },
    []
  );

  // Manually connect socket
  const connect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.connect();
    }
  }, []);

  // Manually disconnect socket
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();

      // Clear joined rooms set on disconnect
      joinedRoomsRef.current.clear();
    }
  }, []);

  // Force reconnect - more robust than simple connect
  const reconnect = useCallback(() => {
    // First disconnect if connected
    if (socketRef.current) {
      socketRef.current.disconnect();

      // Reset error state
      setError(null);

      // Reset connection state
      setIsConnected(false);

      // Clear joined rooms set on reconnect
      joinedRoomsRef.current.clear();

      // Use transport methods in the same order as server configuration
      if (socketRef.current.io && socketRef.current.io.opts) {
        socketRef.current.io.opts.transports = ["polling", "websocket"];
      }

      // Short timeout to ensure clean disconnect before reconnecting
      setTimeout(() => {
        if (socketRef.current) {
          // Force a new connection
          socketRef.current.connect();

          console.log("Socket reconnection initiated");
        }
      }, 500);
    }
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    error,
    joinRoom,
    leaveRoom,
    subscribe,
    connect,
    disconnect,
    reconnect, // Add the reconnect function
  };
};
