import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env from root and current directory
  const env = loadEnv(mode, path.resolve(__dirname, '../..'), '')
  const port = parseInt(env.ORCH_FLOW_PORT || '6102', 10)

  return {
    server: {
      host: "::",
      port,
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  }
});
