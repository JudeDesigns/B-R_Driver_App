const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

// Socket.IO event types
const SocketEvents = {
  CONNECT: "connect",
  DISCONNECT: "disconnect",
  ERROR: "error",
  STOP_STATUS_UPDATED: "stop_status_updated",
  ROUTE_STATUS_UPDATED: "route_status_updated",
  ADMIN_NOTE_CREATED: "admin_note_created",
  DRIVER_LOCATION_UPDATED: "driver_location_updated",
  JOIN_ROUTE_ROOM: "join_route_room",
  JOIN_DRIVER_ROOM: "join_driver_room",
  JOIN_ADMIN_ROOM: "join_admin_room",
  LEAVE_ROOM: "leave_room",
};

// Global Socket.IO server instance
let io;

// Initialize Socket.IO with an HTTP server
function initSocketIO(httpServer) {
  if (io) {
    console.log("> Socket.IO already initialized");
    return io;
  }

  // Initialize Socket.IO with optimized configuration
  io = new Server(httpServer, {
    path: "/socket.io",
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
    // Use polling first, then try to upgrade to WebSocket
    // This helps with environments where WebSocket might be blocked
    transports: ["polling", "websocket"],
    // Allow transport upgrades
    allowUpgrades: true,
    // Increase upgrade timeout for slower connections
    upgradeTimeout: 15000,
    // Optimize ping settings for better performance and reliability
    pingTimeout: 30000,
    pingInterval: 25000,
    // Increase buffer size for better performance with many concurrent connections
    maxHttpBufferSize: 1e6, // 1MB
    // Optimize connection timeout
    connectTimeout: 20000,
    // Enable compression for better network performance
    perMessageDeflate: {
      threshold: 1024, // Only compress messages larger than 1KB
    },
    // Improve reconnection settings
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  // Socket.IO connection handler - optimized for performance
  io.on(SocketEvents.CONNECT, (socket) => {
    // Reduce logging in production for better performance
    if (process.env.NODE_ENV !== "production") {
      console.log("Socket connected:", socket.id);
    }

    try {
      // Get authentication data
      const auth = socket.handshake.auth;
      const token = auth.token;

      // Basic validation
      if (!token) {
        if (process.env.NODE_ENV !== "production") {
          console.log("Socket disconnected: No token provided");
        }
        socket.disconnect();
        return;
      }

      // Decode the JWT token
      try {
        // Use the JWT_SECRET from environment variables
        const JWT_SECRET = process.env.JWT_SECRET;

        if (!JWT_SECRET) {
          console.error("JWT_SECRET environment variable is not set");
          socket.disconnect();
          return;
        }
        const decoded = jwt.verify(token, JWT_SECRET);

        // Extract user info
        const id = decoded.id;
        const username = decoded.username;
        const role = decoded.role;

        // Store user info
        socket.data.user = { id, username, role };

        if (process.env.NODE_ENV !== "production") {
          console.log(`User connected: ${username || id} (${role})`);
        }

        // Join appropriate rooms - optimized to reduce unnecessary joins
        if (role === "DRIVER" && id) {
          socket.join(`driver:${id}`);
          if (process.env.NODE_ENV !== "production") {
            console.log(`Driver ${username} joined driver:${id} room`);
          }
        } else if (["ADMIN", "SUPER_ADMIN"].includes(role)) {
          socket.join("admin");
          if (process.env.NODE_ENV !== "production") {
            console.log(`Admin ${username} joined admin room`);
          }
        }
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error("Invalid token:", error);
        }
        socket.disconnect();
        return;
      }

      // Handle room joining/leaving - optimized with validation
      socket.on(SocketEvents.JOIN_ROUTE_ROOM, (routeId) => {
        if (!routeId) return;

        // Leave any other route rooms first to prevent memory leaks
        const rooms = Array.from(socket.rooms);
        rooms.forEach((room) => {
          if (room.startsWith("route:") && room !== `route:${routeId}`) {
            socket.leave(room);
          }
        });

        socket.join(`route:${routeId}`);

        if (process.env.NODE_ENV !== "production") {
          console.log(`User joined route:${routeId} room`);
        }
      });

      socket.on(SocketEvents.JOIN_DRIVER_ROOM, (driverId) => {
        if (!driverId) return;

        if (["ADMIN", "SUPER_ADMIN"].includes(socket.data.user.role)) {
          socket.join(`driver:${driverId}`);
        }
      });

      socket.on(SocketEvents.JOIN_ADMIN_ROOM, () => {
        if (["ADMIN", "SUPER_ADMIN"].includes(socket.data.user.role)) {
          socket.join("admin");
        }
      });

      socket.on(SocketEvents.LEAVE_ROOM, (room) => {
        if (!room) return;
        socket.leave(room);
      });

      // Handle disconnect - clean up resources
      socket.on(SocketEvents.DISCONNECT, (reason) => {
        if (process.env.NODE_ENV !== "production") {
          console.log(`Socket ${socket.id} disconnected: ${reason}`);
        }

        // Clean up any custom event listeners to prevent memory leaks
        socket.removeAllListeners();
      });
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error in socket connection handler:", error);
      }
      socket.disconnect();
    }
  });

  // Add global error handler for Socket.IO server
  io.engine.on("connection_error", (err) => {
    console.error("Socket.IO connection error:", err);
  });

  // Log transport changes for debugging
  io.engine.on("upgrade", (transport) => {
    console.log(`Socket.IO transport upgraded to: ${transport}`);
  });

  // Add more detailed error handling
  io.on("error", (err) => {
    console.error("Socket.IO server error:", err);
  });

  // Log when clients connect to the engine
  io.engine.on("connection", (socket) => {
    console.log(`Socket.IO engine connection: ${socket.id}`);
  });

  // Log when clients disconnect from the engine
  io.engine.on("close", (reason) => {
    console.log(`Socket.IO engine closed: ${reason}`);
  });

  console.log("> Socket.IO initialized");
  return io;
}

// Create Socket.IO event emitter functions - optimized for performance
const emitStopStatusUpdate = (data) => {
  if (!io) {
    console.error(
      "Socket.IO not initialized when trying to emit stop status update"
    );
    return;
  }

  console.log("Emitting stop status update:", {
    stopId: data.stopId,
    routeId: data.routeId,
    status: data.status,
    event: SocketEvents.STOP_STATUS_UPDATED,
  });

  // Optimize payload size by removing unnecessary data
  const optimizedData = {
    stopId: data.stopId,
    routeId: data.routeId,
    status: data.status,
    driverId: data.driverId,
    driverName: data.driverName,
    customerName: data.customerName,
    timestamp: data.timestamp,
    // Only include other fields if they exist and are needed
    ...(data.sequence && { sequence: data.sequence }),
  };

  // Get list of clients in admin room
  const adminClients = io.sockets.adapter.rooms.get("admin");
  console.log(`Admin room has ${adminClients ? adminClients.size : 0} clients`);

  // Get list of clients in route room
  const routeClients = io.sockets.adapter.rooms.get(`route:${data.routeId}`);
  console.log(
    `Route:${data.routeId} room has ${
      routeClients ? routeClients.size : 0
    } clients`
  );

  // Emit to admin room
  io.to("admin").emit(SocketEvents.STOP_STATUS_UPDATED, optimizedData);
  console.log("Emitted to admin room");

  // Emit to specific route room
  io.to(`route:${data.routeId}`).emit(
    SocketEvents.STOP_STATUS_UPDATED,
    optimizedData
  );
  console.log(`Emitted to route:${data.routeId} room`);
};

const emitRouteStatusUpdate = (data) => {
  if (!io) {
    console.error(
      "Socket.IO not initialized when trying to emit route status update"
    );
    return;
  }

  console.log("Emitting route status update:", {
    routeId: data.routeId,
    status: data.status,
    driverId: data.driverId,
    event: SocketEvents.ROUTE_STATUS_UPDATED,
  });

  // Optimize payload size
  const optimizedData = {
    routeId: data.routeId,
    status: data.status,
    driverId: data.driverId,
    driverName: data.driverName,
    timestamp: data.timestamp,
  };

  // Get list of clients in admin room
  const adminClients = io.sockets.adapter.rooms.get("admin");
  console.log(`Admin room has ${adminClients ? adminClients.size : 0} clients`);

  // Get list of clients in driver room
  const driverClients = io.sockets.adapter.rooms.get(`driver:${data.driverId}`);
  console.log(
    `Driver:${data.driverId} room has ${
      driverClients ? driverClients.size : 0
    } clients`
  );

  // Get list of clients in route room
  const routeClients = io.sockets.adapter.rooms.get(`route:${data.routeId}`);
  console.log(
    `Route:${data.routeId} room has ${
      routeClients ? routeClients.size : 0
    } clients`
  );

  // Emit to admin room
  io.to("admin").emit(SocketEvents.ROUTE_STATUS_UPDATED, optimizedData);
  console.log("Emitted to admin room");

  // Emit to specific driver room
  io.to(`driver:${data.driverId}`).emit(
    SocketEvents.ROUTE_STATUS_UPDATED,
    optimizedData
  );
  console.log(`Emitted to driver:${data.driverId} room`);

  // Also emit to the route room to ensure all clients get the update
  io.to(`route:${data.routeId}`).emit(
    SocketEvents.ROUTE_STATUS_UPDATED,
    optimizedData
  );
  console.log(
    `Also emitted to route:${data.routeId} room for broader delivery`
  );
};

const emitAdminNoteCreated = (data) => {
  if (!io) {
    console.error(
      "Socket.IO not initialized when trying to emit admin note created"
    );
    return;
  }

  console.log("Emitting admin note created:", {
    noteId: data.noteId,
    stopId: data.stopId,
    routeId: data.routeId,
    driverId: data.driverId,
    event: SocketEvents.ADMIN_NOTE_CREATED,
  });

  // Optimize payload size
  const optimizedData = {
    noteId: data.noteId,
    stopId: data.stopId,
    routeId: data.routeId,
    driverId: data.driverId,
    adminId: data.adminId,
    adminName: data.adminName,
    note: data.note,
    timestamp: data.timestamp,
  };

  // Get list of clients in driver room
  const driverClients = io.sockets.adapter.rooms.get(`driver:${data.driverId}`);
  console.log(
    `Driver:${data.driverId} room has ${
      driverClients ? driverClients.size : 0
    } clients`
  );

  // Emit to specific driver room
  io.to(`driver:${data.driverId}`).emit(
    SocketEvents.ADMIN_NOTE_CREATED,
    optimizedData
  );
  console.log(`Emitted to driver:${data.driverId} room`);

  // Also emit to the route room to ensure all clients get the update
  io.to(`route:${data.routeId}`).emit(
    SocketEvents.ADMIN_NOTE_CREATED,
    optimizedData
  );
  console.log(
    `Also emitted to route:${data.routeId} room for broader delivery`
  );
};

const emitDriverLocationUpdate = (data) => {
  if (!io) return;

  // Optimize payload size
  const optimizedData = {
    driverId: data.driverId,
    driverName: data.driverName,
    latitude: data.latitude,
    longitude: data.longitude,
    timestamp: data.timestamp,
  };

  // Emit to admin room
  io.to("admin").emit(SocketEvents.DRIVER_LOCATION_UPDATED, optimizedData);
};

const getSocketServer = () => {
  if (!io) {
    throw new Error("Socket.io server not initialized");
  }
  return io;
};

// Export Socket.IO event emitter functions and initialization function
module.exports = {
  initSocketIO,
  emitStopStatusUpdate,
  emitRouteStatusUpdate,
  emitAdminNoteCreated,
  emitDriverLocationUpdate,
  getSocketServer,
  SocketEvents,
};
