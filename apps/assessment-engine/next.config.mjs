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
    NEXT_PUBLIC_ASSESSMENT_ENGINE_URL:
      process.env.NEXT_PUBLIC_ASSESSMENT_ENGINE_URL ?? "http://localhost:4002",
  },
};

export default nextConfig;
