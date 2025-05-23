/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable TypeScript type checking during production build
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  // Disable ESLint during production build
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
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
