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
      process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3001/v1",
    NEXT_PUBLIC_ASSESSMENT_ENGINE_URL:
      process.env.NEXT_PUBLIC_ASSESSMENT_ENGINE_URL ?? "http://localhost:4002",
    NEXT_PUBLIC_WEBSOCKET_URL:
      process.env.NEXT_PUBLIC_WEBSOCKET_URL ?? "ws://127.0.0.1:3003",
  },
  experimental: {
    allowedDevOrigins: ["localhost:4001", "127.0.0.1:4001"],
  },
};

export default nextConfig;
