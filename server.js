const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { initSocketIO } = require("./src/lib/socket");

// Validate environment variables on startup
// Temporarily disabled for testing
// try {
//   require("./src/lib/env").validateEnvironment();
// } catch (error) {
//   console.error("Environment validation failed:", error.message);
//   process.exit(1);
// }

// Environment configuration
const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.NODE_ENV === "production" ? "0.0.0.0" : "localhost";
const port = parseInt(process.env.PORT) || 3000;

// Initialize Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Create HTTP server
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      const { pathname } = parsedUrl;

      // Manually serve /uploads/ directory to handle dynamic uploads
      if (pathname.startsWith("/uploads/")) {
        const fs = require("fs");
        const path = require("path");
        const filePath = path.join(process.cwd(), "public", pathname);

        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath);
          const ext = path.extname(filePath).toLowerCase();
          const mimeTypes = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".gif": "image/gif",
            ".webp": "image/webp",
          };
          res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
          res.end(content);
          return;
        }
      }

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
  server.on("upgrade", (request) => {
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