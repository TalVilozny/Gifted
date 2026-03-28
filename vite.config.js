import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const pexelsClient = env.VITE_PEXELS_API_KEY?.trim();
  const pexelsServer =
    process.env.PEXELS_API_KEY?.trim() || env.PEXELS_API_KEY?.trim();
  const usePexelsProxy = !pexelsClient && Boolean(pexelsServer);

  return {
    plugins: [
      react(),
      {
        name: "api-proxies-dev",
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const pathname = req.url?.split("?")[0] || "";
            const devEnv = loadEnv(mode, process.cwd(), "");

            if (pathname === "/api/pexels") {
              const apiKey =
                devEnv.PEXELS_API_KEY?.trim() ||
                devEnv.VITE_PEXELS_API_KEY?.trim();

              try {
                const u = new URL(req.url || "/", "http://localhost");
                const q = u.searchParams.get("q")?.trim() || "";
                if (!q) {
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ configured: Boolean(apiKey) }));
                  return;
                }
                if (!apiKey) {
                  res.statusCode = 503;
                  res.setHeader("Content-Type", "application/json");
                  res.end(
                    JSON.stringify({
                      url: null,
                      error:
                        "Set PEXELS_API_KEY or VITE_PEXELS_API_KEY in .env for local dev",
                    }),
                  );
                  return;
                }
                const { resolvePexelsImageUrlForQuery } = await import(
                  "./lib/pexelsSearchLogic.js"
                );
                const imageUrl = await resolvePexelsImageUrlForQuery(q, apiKey);
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ url: imageUrl }));
              } catch (e) {
                res.statusCode = 502;
                res.setHeader("Content-Type", "application/json");
                res.end(
                  JSON.stringify({
                    url: null,
                    error: e instanceof Error ? e.message : "Pexels failed",
                  }),
                );
              }
              return;
            }

            next();
          });
        },
      },
    ],
    define: {
      "import.meta.env.VITE_PEXELS_USE_PROXY": JSON.stringify(usePexelsProxy),
    },
  };
});
