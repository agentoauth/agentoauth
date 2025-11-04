/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@agentoauth/sdk'],
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb'
    }
  },
  webpack: (config, { isServer }) => {
    // Ignore Node.js built-ins in browser builds
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        'fs/promises': false,
        crypto: false,
        stream: false,
        path: false,
      };
    }
    return config;
  }
};

module.exports = nextConfig;

