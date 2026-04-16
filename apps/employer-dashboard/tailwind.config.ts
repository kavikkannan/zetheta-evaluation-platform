import type { Config } from "tailwindcss";
import preset from "../../packages/frontend-config/tailwind/preset.cjs";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    // If you add a shared UI package, include it here:
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  presets: [preset],
  theme: {
    extend: {},
  },
  plugins: [],
};
export default config;
