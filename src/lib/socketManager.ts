import { io, Socket } from "socket.io-client";
import {
  SocketEvents,
  StopStatusUpdateData,
  RouteStatusUpdateData,
  AdminNoteData,
  DriverLocationData,
} from "./socketClient";

// Define event handler types
type EventHandler<T> = (data: T) => void;
type EventMap = {
  [SocketEvents.STOP_STATUS_UPDATED]: EventHandler<StopStatusUpdateData>[];
  [SocketEvents.ROUTE_STATUS_UPDATED]: EventHandler<RouteStatusUpdateData>[];
  [SocketEvents.ADMIN_NOTE_CREATED]: EventHandler<AdminNoteData>[];
  [SocketEvents.DRIVER_LOCATION_UPDATED]: EventHandler<DriverLocationData>[];
  [SocketEvents.CONNECT]: EventHandler<void>[];
  [SocketEvents.DISCONNECT]: EventHandler<void>[];
  [SocketEvents.CONNECT_ERROR]: EventHandler<Error>[];
};

// Define room types
type Room = string;

class SocketManager {
  private static instance: SocketManager;
  private socket: Socket | null = null;
  private token: string | null = null;
  private connected = false;
  private eventHandlers: EventMap = {
    [SocketEvents.STOP_STATUS_UPDATED]: [],
    [SocketEvents.ROUTE_STATUS_UPDATED]: [],
    [SocketEvents.ADMIN_NOTE_CREATED]: [],
    [SocketEvents.DRIVER_LOCATION_UPDATED]: [],
    [SocketEvents.CONNECT]: [],
    [SocketEvents.DISCONNECT]: [],
    [SocketEvents.CONNECT_ERROR]: [],
  };
  private joinedRooms: Set<Room> = new Set();
  private pendingRooms: Set<Room> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private userId: string | null = null;
  private userRole: string | null = null;
  private username: string | null = null;
  private eventBuffer: { event: string; data: any }[] = [];
  private bufferSize = 100; // Maximum number of events to buffer
  private debug = true; // Set to true to enable debug logging

  private constructor() {
    // Private constructor to enforce singleton pattern
    this.log("SocketManager initialized");
  }

  public static getInstance(): SocketManager {
    if (!SocketManager.instance) {
      SocketManager.instance = new SocketManager();
    }
    return SocketManager.instance;
  }

  private log(...args: any[]): void {
    if (this.debug) {
      console.log("[SocketManager]", ...args);
    }
  }

  private error(...args: any[]): void {
    console.error("[SocketManager]", ...args);
  }

  public initialize(
    token: string,
    userId: string,
    userRole: string,
    username: string
  ): void {
    this.log("Initializing with token, userId:", userId, "role:", userRole);

    this.token = token;
    this.userId = userId;
    this.userRole = userRole;
    this.username = username;

    // If we already have a socket, disconnect it
    if (this.socket) {
      this.log("Disconnecting existing socket");
      this.socket.disconnect();
      this.socket = null;
    }

    // Create a new socket connection
    this.socket = io({
      path: "/socket.io",
      auth: { token },
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      // Match server-side transport configuration (polling first, then websocket)
      transports: ["polling", "websocket"],
    });

    // Set up event listeners
    this.setupEventListeners();

    // Connect to the server
    this.connect();
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.log("Setting up event listeners");

    // Connection events
    this.socket.on(SocketEvents.CONNECT, () => {
      this.log("Connected to server");
      this.connected = true;
      this.reconnectAttempts = 0;

      // Join all pending rooms
      this.joinPendingRooms();

      // Notify all connect handlers
      this.notifyEventHandlers(SocketEvents.CONNECT);
    });

    this.socket.on(SocketEvents.DISCONNECT, () => {
      this.log("Disconnected from server");
      this.connected = false;

      // Notify all disconnect handlers
      this.notifyEventHandlers(SocketEvents.DISCONNECT);
    });

    this.socket.on(SocketEvents.CONNECT_ERROR, (err) => {
      this.error("Connection error:", err);

      // Notify all connect error handlers
      this.notifyEventHandlers(SocketEvents.CONNECT_ERROR, err);

      // Increment reconnect attempts
      this.reconnectAttempts++;

      // If we've exceeded the maximum number of reconnect attempts, stop trying
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.error("Maximum reconnect attempts exceeded");
        return;
      }

      // Try to reconnect with polling transport if WebSocket fails
      if (err.message.includes("websocket")) {
        this.log("WebSocket connection failed, falling back to polling");
        if (this.socket) {
          this.socket.io.opts.transports = ["polling"];
          setTimeout(() => this.connect(), this.reconnectDelay);
        }
      }
    });

    // Business events
    this.socket.on(
      SocketEvents.STOP_STATUS_UPDATED,
      (data: StopStatusUpdateData) => {
        this.log("Received stop status update:", data.stopId, data.status);
        this.bufferEvent(SocketEvents.STOP_STATUS_UPDATED, data);
        this.notifyEventHandlers(SocketEvents.STOP_STATUS_UPDATED, data);
      }
    );

    this.socket.on(
      SocketEvents.ROUTE_STATUS_UPDATED,
      (data: RouteStatusUpdateData) => {
        this.log("Received route status update:", data.routeId, data.status);
        this.bufferEvent(SocketEvents.ROUTE_STATUS_UPDATED, data);
        this.notifyEventHandlers(SocketEvents.ROUTE_STATUS_UPDATED, data);
      }
    );

    this.socket.on(SocketEvents.ADMIN_NOTE_CREATED, (data: AdminNoteData) => {
      this.log("Received admin note:", data.stopId, data.noteId);
      this.bufferEvent(SocketEvents.ADMIN_NOTE_CREATED, data);
      this.notifyEventHandlers(SocketEvents.ADMIN_NOTE_CREATED, data);
    });

    this.socket.on(
      SocketEvents.DRIVER_LOCATION_UPDATED,
      (data: DriverLocationData) => {
        this.log("Received driver location update:", data.driverId);
        this.bufferEvent(SocketEvents.DRIVER_LOCATION_UPDATED, data);
        this.notifyEventHandlers(SocketEvents.DRIVER_LOCATION_UPDATED, data);
      }
    );
  }

  private bufferEvent(event: string, data: any): void {
    // Add event to buffer
    this.eventBuffer.push({ event, data });

    // If buffer is full, remove oldest event
    if (this.eventBuffer.length > this.bufferSize) {
      this.eventBuffer.shift();
    }
  }

  private notifyEventHandlers<T>(event: string, data?: T): void {
    // Get handlers for this event
    const handlers = this.eventHandlers[event as keyof EventMap] || [];

    // Notify all handlers
    handlers.forEach((handler) => {
      try {
        handler(data as any);
      } catch (error) {
        this.error("Error in event handler for", event, error);
      }
    });
  }

  public connect(): void {
    if (!this.socket) {
      this.error("Cannot connect: Socket not initialized");
      return;
    }

    this.log("Connecting to server");
    this.socket.connect();
  }

  public disconnect(): void {
    if (!this.socket) return;

    this.log("Disconnecting from server");
    this.socket.disconnect();
  }

  public joinRoom(room: Room): void {
    this.log("Joining room:", room);

    // Add to pending rooms
    this.pendingRooms.add(room);

    // If connected, join immediately
    if (this.connected && this.socket) {
      this.joinRoomNow(room);
    }
  }

  private joinRoomNow(room: Room): void {
    if (!this.socket || !this.connected) return;

    this.log("Joining room now:", room);

    // Emit the appropriate join event based on the room type
    if (room.startsWith("route:")) {
      this.socket.emit(
        SocketEvents.JOIN_ROUTE_ROOM,
        room.replace("route:", "")
      );
    } else if (room.startsWith("driver:")) {
      this.socket.emit(
        SocketEvents.JOIN_DRIVER_ROOM,
        room.replace("driver:", "")
      );
    } else if (room === "admin") {
      this.socket.emit(SocketEvents.JOIN_ADMIN_ROOM);
    }

    // Add to joined rooms
    this.joinedRooms.add(room);

    // Remove from pending rooms
    this.pendingRooms.delete(room);
  }

  private joinPendingRooms(): void {
    this.log("Joining pending rooms:", Array.from(this.pendingRooms));

    // Join all pending rooms
    for (const room of this.pendingRooms) {
      this.joinRoomNow(room);
    }
  }

  public leaveRoom(room: Room): void {
    if (!this.socket || !this.connected) return;

    this.log("Leaving room:", room);

    // Emit leave room event
    this.socket.emit(SocketEvents.LEAVE_ROOM, room);

    // Remove from joined rooms
    this.joinedRooms.delete(room);

    // Remove from pending rooms
    this.pendingRooms.delete(room);
  }

  public subscribe<T>(event: string, handler: EventHandler<T>): () => void {
    this.log("Subscribing to event:", event);

    // Add handler to event handlers
    const handlers = this.eventHandlers[event as keyof EventMap] || [];
    handlers.push(handler as any);
    this.eventHandlers[event as keyof EventMap] = handlers;

    // Return unsubscribe function
    return () => {
      this.log("Unsubscribing from event:", event);
      const handlers = this.eventHandlers[event as keyof EventMap] || [];
      const index = handlers.indexOf(handler as any);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    };
  }

  public getBufferedEvents(event: string): any[] {
    return this.eventBuffer.filter((e) => e.event === event).map((e) => e.data);
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public getConnectionError(): string | null {
    return this.socket?.io?.engine?.transport?.name === "polling"
      ? "Using polling transport (WebSocket failed)"
      : null;
  }

  public joinDefaultRooms(): void {
    this.log("Joining default rooms for user role:", this.userRole);

    // Join rooms based on user role
    if (this.userRole === "ADMIN" || this.userRole === "SUPER_ADMIN") {
      this.joinRoom("admin");
    }

    if (this.userRole === "DRIVER" && this.userId) {
      this.joinRoom(`driver:${this.userId}`);
    }
  }
}

export default SocketManager;
