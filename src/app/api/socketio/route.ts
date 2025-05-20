// Import socket emitter functions from the socket library
const socketEmitters = require("../../../lib/socket");

// Re-export the functions for use in API routes
export const emitStopStatusUpdate = socketEmitters.emitStopStatusUpdate;
export const emitRouteStatusUpdate = socketEmitters.emitRouteStatusUpdate;
export const emitAdminNoteCreated = socketEmitters.emitAdminNoteCreated;
export const emitDriverLocationUpdate = socketEmitters.emitDriverLocationUpdate;
