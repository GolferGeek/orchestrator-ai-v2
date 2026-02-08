import type { NextConfig } from "next";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables from root .env file (monorepo setup)
// This allows open-notebook to use the same env vars as the rest of the monorepo
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const nextConfig: NextConfig = {
  // Standalone output for optimized Docker deployment
  output: 'standalone',

  reactStrictMode: true,

  // Workaround for Next.js 15.4.10 Html import bug
  // Skip trailing slash redirect to reduce static generation
  skipTrailingSlashRedirect: true,

  // Turbopack configuration (Next.js 16+ default)
  // Empty config to silence error - Turbopack handles file watching efficiently by default
  turbopack: {},

  // Pass environment variables to the client
  // These become available as process.env.NEXT_PUBLIC_*
  env: {
    // Supabase configuration - read from server env and expose to client
    NEXT_PUBLIC_SUPABASE_URL: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    // Main API URL for authentication and teams (api.orchestratorai.io)
    NEXT_PUBLIC_MAIN_API_URL: process.env.MAIN_API_URL || process.env.NEXT_PUBLIC_MAIN_API_URL || 'https://api.orchestratorai.io',
  },

  // API Rewrites: Proxy /api/* requests to FastAPI backend
  // This simplifies reverse proxy configuration
  // Next.js handles internal routing to the API backend
  async rewrites() {
    // INTERNAL_API_URL: Where Next.js server-side should proxy API requests
    // If not set, falls back to OPEN_NOTEBOOK_API_PORT
    // Override for multi-container: INTERNAL_API_URL=http://api-service:PORT
    const internalApiUrl = process.env.INTERNAL_API_URL;
    const apiPort = process.env.OPEN_NOTEBOOK_API_PORT;

    if (!internalApiUrl && !apiPort) {
      throw new Error('Either INTERNAL_API_URL or OPEN_NOTEBOOK_API_PORT environment variable must be set');
    }

    const proxyUrl = internalApiUrl || `http://localhost:${apiPort}`;

    console.log(`[Next.js Rewrites] Proxying /api/* to ${proxyUrl}/api/*`)

    return [
      {
        source: '/api/:path*',
        destination: `${proxyUrl}/api/:path*`,
      },
    ]
  },
};

export default nextConfig;
