// This file is deprecated. Import from '@/hooks/useSocket' or '@/contexts/SocketContext' instead.
// This file exists only for backward compatibility.

// Re-export from the correct locations
export { useSocket } from "@/contexts/SocketContext";
export {
  SocketEvents,
  StopStatusUpdateData,
  RouteStatusUpdateData,
  AdminNoteData,
  DriverLocationData,
} from "@/lib/socketClient";

// Deprecated functions - these will log warnings
export const initSocket = (token: string) => {
  console.warn("initSocket is deprecated. Use useSocket hook instead.");
  return null;
};

export const getSocket = () => {
  console.warn("getSocket is deprecated. Use useSocket hook instead.");
  return null;
};

export const connectSocket = () => {
  console.warn("connectSocket is deprecated. Use useSocket hook instead.");
};

export const disconnectSocket = () => {
  console.warn("disconnectSocket is deprecated. Use useSocket hook instead.");
};

export const joinRoom = (room: string) => {
  console.warn("joinRoom is deprecated. Use useSocket hook instead.");
};

export const leaveRoom = (room: string) => {
  console.warn("leaveRoom is deprecated. Use useSocket hook instead.");
};

// Default export for backward compatibility
export { useSocket as default } from "@/contexts/SocketContext";
