const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

// Import enhanced logging (will be transpiled from TypeScript)
let socketLogger;
try {
  socketLogger = require("./socketLogger").socketLogger;
} catch (error) {
  // Fallback to console logging if enhanced logger not available
  socketLogger = {
    logConnection: (clientId, userId, userRole, success) => {
      console.log(`[CONNECTION] ${success ? 'Success' : 'Failed'}: ${clientId}`);
    },
    logAuthentication: (clientId, event, success, errorType, userId, userRole) => {
      console.log(`[AUTH] ${event}: ${success ? 'Success' : 'Failed'} - ${clientId}`);
    },
    logTokenExpiration: (clientId, userId, gracePeriod) => {
      console.log(`[TOKEN] Expired: ${clientId} (Grace: ${gracePeriod})`);
    },
    warn: (event, message, context, metadata, rateLimitKey) => {
      console.warn(`[${context}] ${event}: ${message}`);
    },
    error: (event, message, context, metadata) => {
      console.error(`[${context}] ${event}: ${message}`);
    }
  };
}

// Rate-limited logging utility to prevent log spam
const expiredTokenLogs = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute

function shouldLogExpiredToken(identifier) {
  const now = Date.now();
  const lastLog = expiredTokenLogs.get(identifier);

  if (!lastLog || now - lastLog > RATE_LIMIT_WINDOW) {
    expiredTokenLogs.set(identifier, now);
    return true;
  }
  return false;
}

// Clean up old entries periodically to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of expiredTokenLogs.entries()) {
    if (now - timestamp > RATE_LIMIT_WINDOW * 2) {
      expiredTokenLogs.delete(key);
    }
  }
}, RATE_LIMIT_WINDOW);

// Socket.IO event types
const SocketEvents = {
  CONNECT: "connect",
  DISCONNECT: "disconnect",
  ERROR: "error",
  // Authentication events
  AUTH_ERROR: "auth_error",
  TOKEN_REFRESH_REQUIRED: "token_refresh_required",
  // Data events
  STOP_STATUS_UPDATED: "stop_status_updated",
  ROUTE_STATUS_UPDATED: "route_status_updated",
  ADMIN_NOTE_CREATED: "admin_note_created",
  DRIVER_LOCATION_UPDATED: "driver_location_updated",
  // Room events
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

        // Enhanced connection logging
        socketLogger.logConnection(socket.id, id, role, true);

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
        // Enhanced error handling with graceful token expiration
        if (error.name === 'TokenExpiredError') {
          // Graceful handling for expired tokens
          const clientIdentifier = socket.handshake.address || socket.id;

          // Enhanced rate-limited logging
          socketLogger.logTokenExpiration(socket.id, socket.data.user?.id, true);

          if (shouldLogExpiredToken(clientIdentifier)) {
            socketLogger.warn('TOKEN_EXPIRED', `Expired token from ${clientIdentifier}`, 'AUTH',
              { clientId: socket.id, gracePeriod: true }, `expired_token_${clientIdentifier}`);
          }

          // Emit specific error for expired tokens
          socket.emit(SocketEvents.AUTH_ERROR, {
            type: 'TOKEN_EXPIRED',
            message: 'Authentication token has expired. Please refresh your session.',
            code: 'EXPIRED_TOKEN',
            timestamp: new Date().toISOString()
          });

          // Give client 10 seconds to refresh token before disconnect
          socket.data.authGracePeriod = setTimeout(() => {
            if (!socket.data.authenticated) {
              if (process.env.NODE_ENV !== "production") {
                console.log(`Disconnecting socket ${socket.id} after grace period expired`);
              }
              socket.disconnect();
            }
          }, 10000);

          return; // Don't disconnect immediately

        } else if (error.name === 'JsonWebTokenError' || error.name === 'NotBeforeError') {
          // Handle invalid tokens (more serious security concern)
          const clientIdentifier = socket.handshake.address || socket.id;
          console.warn(`Security Event: Invalid token attempt from ${clientIdentifier} [Socket.IO]`);

          socket.emit(SocketEvents.AUTH_ERROR, {
            type: 'INVALID_TOKEN',
            message: 'Invalid authentication token provided.',
            code: 'INVALID_TOKEN',
            timestamp: new Date().toISOString()
          });

          socket.disconnect();
          return;

        } else {
          // Handle other token verification errors
          if (process.env.NODE_ENV !== "production") {
            console.error("Token verification error:", error);
          }

          socket.emit(SocketEvents.AUTH_ERROR, {
            type: 'VERIFICATION_ERROR',
            message: 'Token verification failed.',
            code: 'VERIFICATION_ERROR',
            timestamp: new Date().toISOString()
          });

          socket.disconnect();
          return;
        }
      }

      // Mark socket as authenticated after successful token verification
      socket.data.authenticated = true;

      // Clear any existing grace period timer
      if (socket.data.authGracePeriod) {
        clearTimeout(socket.data.authGracePeriod);
        socket.data.authGracePeriod = null;
      }

      // Handle token re-authentication for expired tokens
      socket.on('reauthenticate', (newAuth) => {
        if (!newAuth || !newAuth.token) {
          socket.emit(SocketEvents.AUTH_ERROR, {
            type: 'MISSING_TOKEN',
            message: 'No token provided for re-authentication.',
            code: 'MISSING_TOKEN',
            timestamp: new Date().toISOString()
          });
          return;
        }

        try {
          // Verify the new token
          const JWT_SECRET = process.env.JWT_SECRET;
          if (!JWT_SECRET) {
            console.error("JWT_SECRET environment variable is not set");
            socket.disconnect();
            return;
          }

          const decoded = jwt.verify(newAuth.token, JWT_SECRET);

          // Update socket authentication data
          socket.data.user = {
            id: decoded.id,
            username: decoded.username,
            role: decoded.role
          };
          socket.data.authenticated = true;

          // Clear grace period timer
          if (socket.data.authGracePeriod) {
            clearTimeout(socket.data.authGracePeriod);
            socket.data.authGracePeriod = null;
          }

          // Re-join appropriate rooms
          const { id, username, role } = decoded;
          if (role === "DRIVER" && id) {
            socket.join(`driver:${id}`);
            if (process.env.NODE_ENV !== "production") {
              console.log(`Driver ${username} re-authenticated and rejoined driver:${id} room`);
            }
          } else if (["ADMIN", "SUPER_ADMIN"].includes(role)) {
            socket.join("admin");
            if (process.env.NODE_ENV !== "production") {
              console.log(`Admin ${username} re-authenticated and rejoined admin room`);
            }
          }

          // Confirm successful re-authentication
          socket.emit('reauthenticated', {
            success: true,
            timestamp: new Date().toISOString()
          });

        } catch (error) {
          // Re-authentication failed
          if (error.name === 'TokenExpiredError') {
            socket.emit(SocketEvents.AUTH_ERROR, {
              type: 'TOKEN_EXPIRED',
              message: 'Re-authentication token is also expired.',
              code: 'REAUTH_TOKEN_EXPIRED',
              timestamp: new Date().toISOString()
            });
          } else {
            socket.emit(SocketEvents.AUTH_ERROR, {
              type: 'REAUTH_FAILED',
              message: 'Re-authentication failed.',
              code: 'REAUTH_FAILED',
              timestamp: new Date().toISOString()
            });
          }
          socket.disconnect();
        }
      });

      // Handle room joining/leaving - optimized with validation
      // Keep track of joined rooms to prevent duplicate logging
      const joinedRooms = new Set();

      socket.on(SocketEvents.JOIN_ROUTE_ROOM, (routeId) => {
        if (!routeId) return;

        // Leave any other route rooms first to prevent memory leaks
        const rooms = Array.from(socket.rooms);
        rooms.forEach((room) => {
          if (room.startsWith("route:") && room !== `route:${routeId}`) {
            socket.leave(room);
          }
        });

        // Check if already joined to prevent duplicate logging
        const roomKey = `route:${routeId}`;
        if (!joinedRooms.has(roomKey)) {
          socket.join(roomKey);
          joinedRooms.add(roomKey);

          if (process.env.NODE_ENV !== "production") {
            console.log(`User joined route:${routeId} room`);
          }
        }
      });

      socket.on(SocketEvents.JOIN_DRIVER_ROOM, (driverId) => {
        if (!driverId) return;

        if (["ADMIN", "SUPER_ADMIN"].includes(socket.data.user.role)) {
          // Check if already joined to prevent duplicate logging
          const roomKey = `driver:${driverId}`;
          if (!joinedRooms.has(roomKey)) {
            socket.join(roomKey);
            joinedRooms.add(roomKey);

            if (process.env.NODE_ENV !== "production") {
              console.log(`User joined driver:${driverId} room`);
            }
          }
        }
      });

      socket.on(SocketEvents.JOIN_ADMIN_ROOM, () => {
        if (["ADMIN", "SUPER_ADMIN"].includes(socket.data.user.role)) {
          // Check if already joined to prevent duplicate logging
          const roomKey = "admin";
          if (!joinedRooms.has(roomKey)) {
            socket.join(roomKey);
            joinedRooms.add(roomKey);

            if (process.env.NODE_ENV !== "production") {
              console.log(`User joined admin room`);
            }
          }
        }
      });

      socket.on(SocketEvents.LEAVE_ROOM, (room) => {
        if (!room) return;
        socket.leave(room);

        // Remove from joined rooms set
        joinedRooms.delete(room);

        if (process.env.NODE_ENV !== "production") {
          console.log(`User left room: ${room}`);
        }
      });

      // Test helper for connection resilience testing
      socket.on('test_connection_resilience', () => {
        if (process.env.NODE_ENV !== "production") {
          console.log('Test: Connection resilience test completed');
        }
      });

      // Handle disconnect - clean up resources
      socket.on(SocketEvents.DISCONNECT, (reason) => {
        if (process.env.NODE_ENV !== "production") {
          console.log(`Socket ${socket.id} disconnected: ${reason}`);
        }

        // Clear joined rooms set
        joinedRooms.clear();

        // Clean up grace period timer if it exists
        if (socket.data.authGracePeriod) {
          clearTimeout(socket.data.authGracePeriod);
          socket.data.authGracePeriod = null;
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
