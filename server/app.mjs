import express from "express";
import path from "node:path";
import fs from "node:fs";
export function createApp({ distDir, revision = "development" }) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", false);
  app.use((_req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'",
    });
    next();
  });
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.get("/api/health", (_req, res) => {
    const ready = Boolean(
      distDir && fs.existsSync(path.join(distDir, "index.html")),
    );
    res
      .status(ready ? 200 : 503)
      .json({
        status: ready ? "ok" : "unavailable",
        version: "0.3.0",
        revision,
      });
  });
  app.use("/api", (_req, res) => res.status(404).json({ error: "接口不存在" }));
  if (distDir)
    app.use(
      express.static(distDir, {
        dotfiles: "deny",
        setHeaders(res, filename) {
          res.set(
            "Cache-Control",
            /[\\/]assets[\\/][^\\/]+-[A-Za-z0-9_-]{8}\.(?:js|css)$/.test(filename)
              ? "public, max-age=31536000, immutable"
              : "no-cache",
          );
        },
      }),
    );
  app.use((_req, res) => res.status(404).send("Not found"));
  return app;
}
