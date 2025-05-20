"use client";

import React, { createContext, useContext } from "react";
import { useSocket as useSocketHook } from "@/hooks/useSocket";

// Create a context to provide socket functionality throughout the app
const SocketContext = createContext<ReturnType<typeof useSocketHook> | null>(
  null
);

// Provider component that wraps the app and provides socket functionality
export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  // Use the consolidated socket hook
  const socketState = useSocketHook({ autoConnect: true });

  return (
    <SocketContext.Provider value={socketState}>
      {children}
    </SocketContext.Provider>
  );
};

// Custom hook to use the socket context
export const useSocket = () => {
  const context = useContext(SocketContext);

  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }

  return context;
};

// Export the context for direct use
export default SocketContext;
