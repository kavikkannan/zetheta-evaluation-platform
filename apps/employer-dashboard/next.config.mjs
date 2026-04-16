/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  env: {
    NEXT_PUBLIC_API_BASE_URL:
      process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/v1",
    NEXT_PUBLIC_WEBSOCKET_URL:
      process.env.NEXT_PUBLIC_WEBSOCKET_URL ?? "ws://localhost:3003",
  },
};

export default nextConfig;
