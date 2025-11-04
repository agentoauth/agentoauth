/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@agentoauth/sdk'],
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb'
    }
  }
};

module.exports = nextConfig;

