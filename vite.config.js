import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const clientKey = env.VITE_GROQ_API_KEY?.trim();
  const serverOnlyKey =
    process.env.GROQ_API_KEY?.trim() || env.GROQ_API_KEY?.trim();
  const useGroqProxy = !clientKey && Boolean(serverOnlyKey);

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
                  "./src/lib/pexelsSearchLogic.js"
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

            if (pathname !== "/api/groq") {
              next();
              return;
            }

            const apiKey =
              devEnv.GROQ_API_KEY?.trim() || devEnv.VITE_GROQ_API_KEY?.trim();

            if (req.method === "GET") {
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ configured: Boolean(apiKey) }));
              return;
            }

            if (req.method !== "POST") {
              res.statusCode = 405;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "Method not allowed" }));
              return;
            }

            if (!apiKey) {
              res.statusCode = 503;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  error:
                    "Set GROQ_API_KEY or VITE_GROQ_API_KEY in .env for local dev",
                }),
              );
              return;
            }

            const chunks = [];
            for await (const chunk of req) {
              chunks.push(chunk);
            }
            const raw = Buffer.concat(chunks).toString();
            let body;
            try {
              body = raw ? JSON.parse(raw) : {};
            } catch {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "Invalid JSON body" }));
              return;
            }

            const { prompt, options: opt = {} } = body || {};
            if (typeof prompt !== "string") {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "Missing prompt" }));
              return;
            }

            try {
              const { callGroqChat } = await import("./server/groqProxyCore.js");
              const content = await callGroqChat(apiKey, {
                prompt,
                model: opt.model,
                temperature: opt.temperature,
                max_tokens: opt.max_tokens,
                baseUrl: opt.baseUrl || devEnv.VITE_GROQ_API_BASE?.trim(),
              });
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ content }));
            } catch (e) {
              res.statusCode = 502;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  error: e instanceof Error ? e.message : "Groq request failed",
                }),
              );
            }
          });
        },
      },
    ],
    define: {
      "import.meta.env.VITE_GROQ_USE_PROXY": JSON.stringify(useGroqProxy),
      "import.meta.env.VITE_PEXELS_USE_PROXY": JSON.stringify(usePexelsProxy),
    },
  };
});
