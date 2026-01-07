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

      // Proactive token validation - ensure token is valid before connecting
      if (token && (tokenManager.isTokenExpired(token) || tokenManager.isTokenExpiringSoon(token))) {
        console.log("WebSocket: Token expired or expiring soon, refreshing before connection");

        // Use async token refresh to ensure we have a valid token
        tokenManager.ensureValidToken().then((validToken) => {
          if (validToken) {
            // Update token and user data from storage after refresh
            token = validToken;
            userRole = localStorage.getItem("userRole") || sessionStorage.getItem("userRole");
            userId = localStorage.getItem("userId") || sessionStorage.getItem("userId");
            username = localStorage.getItem("username") || sessionStorage.getItem("username");

            // Proceed with connection using valid token
            proceedWithConnection(validToken, userRole, userId, username);
          } else {
            console.log("WebSocket: Token refresh failed, cannot connect");
            setIsConnected(false);
            setError("Authentication failed. Please log in again.");
          }
        }).catch((error) => {
          console.log("WebSocket: Token refresh error:", error);
          setIsConnected(false);
          setError("Authentication failed. Please log in again.");
        });
        return; // Exit early, connection will be handled in the promise
      }
    }

    if (!token) {
      // Don't show error popup for missing token - just silently fail
      // This prevents annoying popups on different phones or expired sessions
      console.log("No authentication token found for WebSocket connection");
      setIsConnected(false);
      return;
    }

    // Helper functions for authentication error handling
    async function handleTokenExpiredError(socket: any, role: string | null, id: string | null, user: string | null) {
      console.log("WebSocket: Token expired, attempting refresh...");

      try {
        const newToken = await tokenManager.refreshToken();

        if (newToken) {
          // Re-authenticate with new token
          socket.emit('reauthenticate', {
            token: newToken,
            role: role,
            id: id,
            username: user
          });
        } else {
          setError("Session expired. Please log in again.");
          setIsConnected(false);
        }
      } catch (error) {
        console.error("WebSocket: Token refresh failed:", error);
        setError("Session expired. Please log in again.");
        setIsConnected(false);
      }
    }

    function handleInvalidTokenError() {
      console.log("WebSocket: Invalid token, clearing session");
      setError("Session invalid. Please log in again.");
      setIsConnected(false);

      // Clear tokens
      localStorage.removeItem("token");
      sessionStorage.removeItem("token");
    }

    // Proceed with connection using validated token
    proceedWithConnection(token, userRole, userId, username);

    // Connection function with enhanced error handling
    function proceedWithConnection(validToken: string, role: string | null, id: string | null, user: string | null) {

      // Create socket connection to the Socket.IO server on the same port as the app
      const socketServerUrl =
        typeof window !== "undefined" ? window.location.origin : "";

      // Only log in development mode
      if (process.env.NODE_ENV !== "production") {
        console.log("Auth info:", { token: "***", role, id, user });
      }

      // Create an optimized Socket.IO connection with performance enhancements
      const socket = io(socketServerUrl, {
        path: "/socket.io",
        auth: {
          token: validToken,
          role: role,
          id: id,
          username: user,
        },
      // Optimize transport configuration for better performance
      // IMPORTANT: Match server configuration - polling first, then upgrade to WebSocket
      // This prevents connection issues on mobile networks
      transports: ["polling", "websocket"],
      // Optimize reconnection settings for mobile reliability
      reconnection: true,
      reconnectionAttempts: 10, // Increased for mobile network recovery
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000, // Increased to 10s for slow mobile networks
      randomizationFactor: 0.3,
      // Optimize timeout settings for mobile devices
      timeout: 20000, // Increased to 20s for mobile networks
      // Enable auto-connect
      autoConnect: true,
      // Optimize buffer size and memory usage
      rememberUpgrade: true,
      // Use connection pooling instead of forcing new connections
      forceNew: false,
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

      // Enhanced authentication error handling
      socket.on(SocketEvents.AUTH_ERROR, (authError: any) => {
        console.log("WebSocket: Received auth error:", authError.type, "-", authError.message);

        if (authError.type === 'TOKEN_EXPIRED') {
          handleTokenExpiredError(socket, role, id, user);
        } else if (authError.type === 'INVALID_TOKEN') {
          handleInvalidTokenError();
        } else {
          console.log("WebSocket: Authentication error:", authError.message);
          setError(`Authentication error: ${authError.message}`);
        }
      });

      // Re-authentication success handler
      socket.on('reauthenticated', (data: any) => {
        console.log("WebSocket: Re-authentication successful");
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
        // WebSocket specific error - log but don't show popup during normal reconnection
        console.log(`WebSocket connection error: ${err.message}. Trying to reconnect...`);
        // Don't set error state to avoid popup during normal reconnection attempts
      } else {
        // Other connection errors - log but don't show popup during normal reconnection
        console.log(`Connection error: ${err.message}. Trying to reconnect...`);
        // Don't set error state to avoid popup during normal reconnection attempts
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

      // Don't show error popup during normal reconnection attempts
      // setError(`Connection error - reconnection attempt #${attemptNumber}...`);
    });

    socket.io.on("reconnect_failed", () => {
      if (process.env.NODE_ENV !== "production") {
        console.error("Socket reconnection failed after all attempts");
      }
      // Only show error if reconnection completely fails after many attempts
      setError("Connection lost - please refresh the page if issues persist");
    });

    // Add error event handler
    socket.on("error", (err: Error) => {
      console.error("Socket error:", err);
      // Don't show popup for general socket errors - just log them
      // setError(`Socket error: ${err.message}`);
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
    } // End of proceedWithConnection function
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

  // Handle network online/offline events for mobile
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      console.log('Network connection restored, reconnecting socket...');
      if (socketRef.current && !isConnected) {
        reconnect();
      }
    };

    const handleOffline = () => {
      console.log('Network connection lost');
      setIsConnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isConnected, reconnect]);

  // Handle page visibility changes for mobile (when driver switches apps)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Page became visible, checking socket connection...');
        // Check if socket is disconnected and reconnect
        if (socketRef.current && !isConnected) {
          console.log('Socket disconnected while page was hidden, reconnecting...');
          reconnect();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isConnected, reconnect]);

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
