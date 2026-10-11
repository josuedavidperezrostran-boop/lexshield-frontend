import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import path from "path";

// Load the repo-root .env into this Next.js process (in-memory).
const projectRoot = path.resolve(__dirname, "..");
loadEnvConfig(projectRoot);

const LIVE_API_URL = "https://lexshield-backend.onrender.com";

function resolveApiUrl(): string {
  const value = (process.env.NEXT_PUBLIC_API_URL ?? "").trim().replace(/\/+$/, "");
  const bareRenderSite = value === "https://onrender.com" || value === "http://onrender.com";
  const local = !value || value.includes("localhost") || value.includes("127.0.0.1");
  if (process.env.NODE_ENV === "production" || bareRenderSite || local) {
    return LIVE_API_URL;
  }
  return value;
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  env: {
    NEXT_PUBLIC_API_URL: resolveApiUrl(),
    // Publishable key only. OPENAI_API_KEY and STRIPE_SECRET_KEY stay on FastAPI.
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ??
      process.env.STRIPE_PUBLISHABLE_KEY ??
      "",
  },
};

export default nextConfig;
