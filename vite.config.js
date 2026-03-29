import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import {
  groqOpenAIChatCompletion,
  resolveGroqApiBaseFromEnv,
  resolveGroqApiKeyFromEnv,
} from "./lib/groqApiForward.js";

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

            if (pathname === "/api/groq") {
              const apiKey = resolveGroqApiKeyFromEnv(devEnv);
              const apiBase = resolveGroqApiBaseFromEnv(devEnv);

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
                      "Set GROQ_API_KEY or VITE_GROQ_API_KEY in .env (and VITE_GROQ_PROXY=1 for proxy mode)",
                  }),
                );
                return;
              }

              const raw = await new Promise((resolve, reject) => {
                const chunks = [];
                req.on("data", (c) => chunks.push(c));
                req.on("end", () =>
                  resolve(Buffer.concat(chunks).toString("utf8")),
                );
                req.on("error", reject);
              });

              let body;
              try {
                body = raw.trim() ? JSON.parse(raw) : null;
              } catch {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: "Invalid JSON body" }));
                return;
              }

              if (!body || typeof body !== "object") {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: "Expected JSON object" }));
                return;
              }

              const { model, messages, temperature, max_tokens } = body;
              if (typeof model !== "string" || !Array.isArray(messages)) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(
                  JSON.stringify({
                    error:
                      "Body must include model (string) and messages (array)",
                  }),
                );
                return;
              }

              try {
                const data = await groqOpenAIChatCompletion(
                  {
                    model,
                    messages,
                    ...(typeof temperature === "number" ? { temperature } : {}),
                    ...(typeof max_tokens === "number" ? { max_tokens } : {}),
                  },
                  apiKey,
                  apiBase,
                );
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify(data));
              } catch (e) {
                const status =
                  e && typeof e.status === "number" && e.status >= 400
                    ? e.status
                    : 502;
                res.statusCode = status;
                res.setHeader("Content-Type", "application/json");
                res.end(
                  JSON.stringify({
                    error: e instanceof Error ? e.message : "Groq request failed",
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
