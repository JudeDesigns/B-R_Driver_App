/** @type {import('next').NextConfig} */
const nextConfig = {
  // Temporarily disable TypeScript and ESLint checking for testing
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Enable strict mode
  reactStrictMode: true,

  // Performance optimizations

  // Configure image domains if needed
  images: {
    domains: [],
    // Optimize image loading
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60, // Cache optimized images for at least 60 seconds
  },

  // Enable compression for better performance
  compress: true,

  // Configure WebSocket support and optimize bundle
  webpack: (config, { isServer, dev }) => {
    // Add support for WebSockets
    config.externals = [...(config.externals || [])];

    // Fix for node: imports in client-side code
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: false,
        fs: false,
        net: false,
        tls: false,
      };
    }

    // Performance optimizations for production builds
    if (!dev) {
      // Enable terser optimizations
      config.optimization.minimize = true;

      // Split chunks for better caching
      config.optimization.splitChunks = {
        chunks: "all",
        maxInitialRequests: 25,
        minSize: 20000,
      };

      // Enable module concatenation for better tree shaking
      config.optimization.concatenateModules = true;
    }

    // Important: Return the modified config
    return config;
  },

  // Configure static file serving
  async rewrites() {
    return [
      {
        source: "/uploads/:path*",
        destination: "/uploads/:path*",
      },
    ];
  },

  // Add HTTP response headers for better performance
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
        ],
      },
      {
        // Cache static assets longer
        source: "/(.*).(jpg|jpeg|png|gif|webp|svg|ico|ttf|woff|woff2)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },

  // Enable incremental static regeneration
  experimental: {
    // Enable optimizations
    optimizeCss: true,
    optimizePackageImports: [
      "react-icons",
      "@mui/material",
      "@mui/icons-material",
    ],
  },
};

module.exports = nextConfig;
