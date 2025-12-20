"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { SocketEvents, AuthErrorData } from "@/lib/socketClient";
import { optimizeSocketHandler } from "@/lib/performance";
import { tokenManager } from "@/lib/tokenRefresh";

interface UseEnhancedSocketOptions {
  autoConnect?: boolean;
  token?: string | null;
}

export const useEnhancedSocket = (
  optionsOrToken: UseEnhancedSocketOptions | string | null = {}
) => {
  // Handle both options object and direct token string
  let options: UseEnhancedSocketOptions;

  if (typeof optionsOrToken === "string" || optionsOrToken === null) {
    options = { token: optionsOrToken, autoConnect: true };
  } else {
    options = optionsOrToken;
  }

  const { autoConnect = true, token: providedToken } = options;

  // State management
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);

  // Refs
  const socketRef = useRef<Socket | null>(null);
  const joinedRoomsRef = useRef<Set<string>>(new Set());
  const eventHandlersRef = useRef<Map<string, Function[]>>(new Map());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Constants
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000]; // Exponential backoff

  // Enhanced connection function with proactive token management
  const connectSocket = useCallback(async () => {
    try {
      // Clear any existing reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // Ensure we have a valid token BEFORE connecting
      const validToken = await tokenManager.ensureValidToken();
      
      if (!validToken) {
        console.log("WebSocket: No valid token available for connection");
        setIsConnected(false);
        setError("Authentication required. Please log in again.");
        return;
      }

      // Get authentication data from storage (should be fresh after token validation)
      let userRole = localStorage.getItem("userRole") || sessionStorage.getItem("userRole");
      let userId = localStorage.getItem("userId") || sessionStorage.getItem("userId");
      let username = localStorage.getItem("username") || sessionStorage.getItem("username");

      if (!userRole || !userId) {
        console.log("WebSocket: Missing user data for connection");
        setIsConnected(false);
        setError("User data missing. Please log in again.");
        return;
      }

      // Create socket connection
      const socketServerUrl = typeof window !== "undefined" ? window.location.origin : "";

      if (process.env.NODE_ENV !== "production") {
        console.log("WebSocket: Creating connection with valid token");
      }

      const socket = io(socketServerUrl, {
        path: "/socket.io",
        auth: {
          token: validToken,
          role: userRole,
          id: userId,
          username: username,
        },
        transports: ["websocket", "polling"],
        reconnection: false, // We'll handle reconnection manually
        timeout: 10000,
        forceNew: true,
        upgrade: true,
      });

      // Enhanced authentication error handling
      socket.on(SocketEvents.AUTH_ERROR, (authError: AuthErrorData) => {
        console.log("WebSocket: Received auth error:", authError.type, "-", authError.message);
        
        if (authError.type === 'TOKEN_EXPIRED') {
          handleTokenExpired(socket);
        } else if (authError.type === 'INVALID_TOKEN') {
          handleInvalidToken();
        } else {
          handleAuthError(authError);
        }
      });

      // Re-authentication success handler
      socket.on('reauthenticated', (data) => {
        console.log("WebSocket: Re-authentication successful");
        setIsConnected(true);
        setError(null);
        setReconnectAttempts(0);
        
        // Rejoin all previously joined rooms
        joinedRoomsRef.current.forEach(room => {
          socket.emit(SocketEvents.JOIN_ROUTE_ROOM, room.replace('route:', ''));
        });
      });

      // Connection events
      socket.on(SocketEvents.CONNECT, () => {
        if (process.env.NODE_ENV !== "production") {
          console.log("WebSocket: Connected successfully");
        }
        setIsConnected(true);
        setError(null);
        setReconnectAttempts(0);
        setIsReconnecting(false);
      });

      socket.on(SocketEvents.DISCONNECT, (reason) => {
        if (process.env.NODE_ENV !== "production") {
          console.log(`WebSocket: Disconnected - ${reason}`);
        }
        setIsConnected(false);
        
        // Only attempt reconnection for certain disconnect reasons
        if (reason === 'io server disconnect' || reason === 'transport close') {
          attemptReconnection();
        }
      });

      socket.on(SocketEvents.CONNECT_ERROR, (err: Error) => {
        console.log("WebSocket: Connection error -", err.message);
        setIsConnected(false);
        
        // Don't show error popup for authentication issues
        if (!err.message.includes("authentication") && !err.message.includes("token")) {
          attemptReconnection();
        }
      });

      // Store socket reference
      socketRef.current = socket;

    } catch (error) {
      console.error("WebSocket: Connection setup failed:", error);
      setError("Failed to establish connection");
      attemptReconnection();
    }
  }, []);

  // Handle token expiration with re-authentication
  const handleTokenExpired = useCallback(async (socket: Socket) => {
    console.log("WebSocket: Token expired, attempting refresh...");
    
    try {
      const newToken = await tokenManager.refreshToken();
      
      if (newToken) {
        // Re-authenticate with new token
        const userRole = localStorage.getItem("userRole") || sessionStorage.getItem("userRole");
        const userId = localStorage.getItem("userId") || sessionStorage.getItem("userId");
        const username = localStorage.getItem("username") || sessionStorage.getItem("username");
        
        socket.emit('reauthenticate', {
          token: newToken,
          role: userRole,
          id: userId,
          username: username
        });
      } else {
        handleAuthError({ type: 'TOKEN_EXPIRED', message: 'Token refresh failed', code: 'REFRESH_FAILED', timestamp: new Date().toISOString() });
      }
    } catch (error) {
      console.error("WebSocket: Token refresh failed:", error);
      handleAuthError({ type: 'TOKEN_EXPIRED', message: 'Token refresh failed', code: 'REFRESH_FAILED', timestamp: new Date().toISOString() });
    }
  }, []);

  // Handle invalid token
  const handleInvalidToken = useCallback(() => {
    console.log("WebSocket: Invalid token, redirecting to login");
    setError("Session invalid. Please log in again.");
    
    // Clear tokens and redirect
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    
    if (typeof window !== "undefined") {
      window.location.href = '/login';
    }
  }, []);

  // Handle general authentication errors
  const handleAuthError = useCallback((authError: AuthErrorData) => {
    console.log("WebSocket: Authentication error:", authError.message);
    setError(`Authentication error: ${authError.message}`);
    setIsConnected(false);
  }, []);

  // Exponential backoff reconnection
  const attemptReconnection = useCallback(() => {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.log("WebSocket: Max reconnection attempts reached");
      setError("Connection lost. Please refresh the page.");
      setIsReconnecting(false);
      return;
    }

    const delay = RECONNECT_DELAYS[Math.min(reconnectAttempts, RECONNECT_DELAYS.length - 1)];
    
    console.log(`WebSocket: Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);
    setIsReconnecting(true);
    setReconnectAttempts(prev => prev + 1);

    reconnectTimeoutRef.current = setTimeout(() => {
      connectSocket();
    }, delay);
  }, [reconnectAttempts, connectSocket]);

  // Initialize connection
  useEffect(() => {
    if (!autoConnect) return;

    connectSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [autoConnect, connectSocket]);

  // Room management functions
  const joinRoom = useCallback((room: string) => {
    if (!socketRef.current || !isConnected) return;

    const roomKey = room.startsWith('route:') ? room : `route:${room}`;
    
    if (!joinedRoomsRef.current.has(roomKey)) {
      socketRef.current.emit(SocketEvents.JOIN_ROUTE_ROOM, room.replace('route:', ''));
      joinedRoomsRef.current.add(roomKey);
      
      if (process.env.NODE_ENV !== "production") {
        console.log(`WebSocket: Joined room ${roomKey}`);
      }
    }
  }, [isConnected]);

  const leaveRoom = useCallback((room: string) => {
    if (!socketRef.current) return;

    const roomKey = room.startsWith('route:') ? room : `route:${room}`;
    socketRef.current.emit(SocketEvents.LEAVE_ROOM, roomKey);
    joinedRoomsRef.current.delete(roomKey);
    
    if (process.env.NODE_ENV !== "production") {
      console.log(`WebSocket: Left room ${roomKey}`);
    }
  }, []);

  // Event subscription with optimization
  const subscribe = useCallback(<T = any>(event: string, handler: (data: T) => void) => {
    if (!socketRef.current) return () => {};

    const optimizedHandler = optimizeSocketHandler(handler);
    socketRef.current.on(event, optimizedHandler);

    // Track handlers for cleanup
    if (!eventHandlersRef.current.has(event)) {
      eventHandlersRef.current.set(event, []);
    }
    eventHandlersRef.current.get(event)!.push(optimizedHandler);

    return () => {
      if (socketRef.current) {
        socketRef.current.off(event, optimizedHandler);
      }
      
      const handlers = eventHandlersRef.current.get(event);
      if (handlers) {
        const index = handlers.indexOf(optimizedHandler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }, []);

  // Manual reconnection
  const reconnect = useCallback(() => {
    setReconnectAttempts(0);
    connectSocket();
  }, [connectSocket]);

  return {
    isConnected,
    error,
    isReconnecting,
    reconnectAttempts,
    joinRoom,
    leaveRoom,
    subscribe,
    reconnect,
  };
};
