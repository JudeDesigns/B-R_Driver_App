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
  // Configure image domains if needed
  images: {
    domains: [],
  },
};

module.exports = nextConfig;
