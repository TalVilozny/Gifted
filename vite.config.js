import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const clientKey = env.VITE_GROQ_API_KEY?.trim();
  /** Vercel injects into process.env at build time; loadEnv reads .env files */
  const serverOnlyKey =
    process.env.GROQ_API_KEY?.trim() || env.GROQ_API_KEY?.trim();
  /** Prefer direct browser calls when VITE_ key exists; otherwise use /api/groq + server key */
  const useGroqProxy = !clientKey && Boolean(serverOnlyKey);

  return {
    plugins: [
      react(),
      {
        name: "groq-api-dev",
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const pathname = req.url?.split("?")[0] || "";
            if (pathname !== "/api/groq") {
              next();
              return;
            }

            const devEnv = loadEnv(mode, process.cwd(), "");
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
    },
  };
});
