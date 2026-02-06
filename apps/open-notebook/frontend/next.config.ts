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
    // Get API port from environment variable (default: 6202)
    const apiPort = process.env.OPEN_NOTEBOOK_API_PORT || '6202'
    // INTERNAL_API_URL: Where Next.js server-side should proxy API requests
    // Default: http://localhost:PORT (single-container deployment)
    // Override for multi-container: INTERNAL_API_URL=http://api-service:PORT
    const internalApiUrl = process.env.INTERNAL_API_URL || `http://localhost:${apiPort}`

    console.log(`[Next.js Rewrites] Proxying /api/* to ${internalApiUrl}/api/*`)

    return [
      {
        source: '/api/:path*',
        destination: `${internalApiUrl}/api/:path*`,
      },
    ]
  },
};

export default nextConfig;
