import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for optimized Docker deployment
  output: "standalone",

  // Pass environment variables to the client
  // These become available as process.env.NEXT_PUBLIC_*
  env: {
    // Supabase configuration - read from server env and expose to client
    NEXT_PUBLIC_SUPABASE_URL: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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
