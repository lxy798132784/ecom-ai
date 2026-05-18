/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },
  experimental: { serverActions: { bodySizeLimit: '50mb' } },
};
module.exports = nextConfig;
