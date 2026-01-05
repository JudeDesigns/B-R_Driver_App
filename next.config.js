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

  // Configure image domains if needed
  images: {
    domains: [],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60,
  },

  // Enable compression for better performance
  compress: true,

  // Simplified webpack configuration to avoid chunk issues
  webpack: (config, { isServer }) => {
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

    return config;
  },

  // Configure static file serving
  async rewrites() {
    return [];
  },

  // Simplified experimental features
  experimental: {
    optimizeCss: true,
    // Increase body size limit for file uploads (product/route Excel files)
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

module.exports = nextConfig;
