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
      process.env.NEXT_PUBLIC_ASSESSMENT_ENGINE_URL ?? "http://127.0.0.1:4002",
  },
  experimental: {
    allowedDevOrigins: ["localhost:4002", "127.0.0.1:4002"],
  },
};

export default nextConfig;
