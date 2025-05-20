"use client";

// Define socket event types
export enum SocketEvents {
  CONNECT = "connect",
  DISCONNECT = "disconnect",
  CONNECT_ERROR = "connect_error",
  ERROR = "error",
  STOP_STATUS_UPDATED = "stop_status_updated",
  ROUTE_STATUS_UPDATED = "route_status_updated",
  ADMIN_NOTE_CREATED = "admin_note_created",
  DRIVER_LOCATION_UPDATED = "driver_location_updated",
  JOIN_ROUTE_ROOM = "join_route_room",
  JOIN_DRIVER_ROOM = "join_driver_room",
  JOIN_ADMIN_ROOM = "join_admin_room",
  LEAVE_ROOM = "leave_room",
  // Test events
  TEST_STOP_STATUS = "test_stop_status",
  TEST_ADMIN_NOTE = "test_admin_note",
}

// Define socket data types
export interface StopStatusUpdateData {
  stopId: string;
  routeId: string;
  status: string;
  driverId: string;
  driverName: string;
  customerName: string;
  timestamp: string;
}

export interface RouteStatusUpdateData {
  routeId: string;
  status: string;
  driverId: string;
  driverName: string;
  timestamp: string;
}

export interface AdminNoteData {
  noteId: string;
  stopId: string;
  routeId: string;
  driverId: string;
  adminId: string;
  adminName: string;
  note: string;
  timestamp: string;
}

export interface DriverLocationData {
  driverId: string;
  driverName: string;
  latitude: number;
  longitude: number;
  timestamp: string;
}
