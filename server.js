const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { initSocketIO } = require("./src/lib/socket");

// Environment configuration
const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;

// Initialize Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Create HTTP server
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });

  // Initialize Socket.IO with the same server
  initSocketIO(server);

  // Log WebSocket upgrade requests but don't interfere with Socket.IO's handling
  server.on("upgrade", (request, socket, head) => {
    const pathname = parse(request.url).pathname;

    // Just log the upgrade request without interfering with Socket.IO's handling
    if (pathname.startsWith("/socket.io/")) {
      console.log("WebSocket upgrade request for Socket.IO detected");
    }
  });

  // Start the server
  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Server running on http://${hostname}:${port}`);
    console.log(`> WebSocket server running on ws://${hostname}:${port}`);
  });
});

// Export Socket.IO event emitter functions from src/lib/socket.js
module.exports = require("./src/lib/socket");
