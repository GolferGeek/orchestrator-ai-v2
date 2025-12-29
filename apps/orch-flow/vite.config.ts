import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env from root directory (project root)
  // Vite automatically loads .env files, but we need to ensure it looks in the right place
  const rootDir = path.resolve(__dirname, '../..')
  const env = loadEnv(mode, rootDir, '')
  const port = parseInt(env.ORCH_FLOW_PORT || process.env.ORCH_FLOW_PORT || '6102', 10)
  
  // Debug: Log env vars to verify they're loaded (remove in production)
  if (mode === 'development') {
    console.log('🔧 Vite Environment Variables:')
    console.log('  Root dir:', rootDir)
    console.log('  VITE_SUPABASE_URL:', env.VITE_SUPABASE_URL || 'NOT FOUND')
    console.log('  VITE_SUPABASE_ANON_KEY:', env.VITE_SUPABASE_ANON_KEY ? 'FOUND' : 'NOT FOUND')
  }

  return {
    // Explicitly tell Vite where to find .env files (project root)
    // This ensures VITE_ prefixed variables are available to client code via import.meta.env
    envDir: rootDir,
    server: {
      host: "::",
      port,
      // Allow Tailscale and local hosts in development
      // Include common Tailscale hostname patterns
      allowedHosts: mode === 'development' 
        ? [
            'gg-macstudio',
            'localhost',
            '127.0.0.1',
            '.local',  // Matches *.local domains
            '.ts.net', // Matches Tailscale *.ts.net domains
          ]
        : undefined,
      hmr: {
        // Explicit HMR configuration for WebSocket connection
        // When using host: "::", we need to tell the browser where to connect
        host: 'localhost',
        port: port,
        protocol: 'ws'
      }
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  }
});
