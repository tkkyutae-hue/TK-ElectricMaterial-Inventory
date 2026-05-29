import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { setupAuth } from "./replit_integrations/auth";
import { pool } from "./db";
import { runSeed } from "./seed";
import { backfillSizeSortValues, runItemGroupsMigration } from "./storage";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

// ─── Boot-time environment validation ────────────────────────────────────────
const REQUIRED_ENV = ["DATABASE_URL", "SESSION_SECRET"] as const;
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`[boot] FATAL — missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

app.use(
  express.json({
    limit: "50mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

(async () => {
  // ─── Verify DB connectivity (retry up to 10×, 3 s apart) ───────────────
  {
    let lastErr: any;
    for (let attempt = 1; attempt <= 10; attempt++) {
      try {
        const client = await pool.connect();
        client.release();
        log("database connection OK", "db");
        lastErr = null;
        break;
      } catch (err: any) {
        lastErr = err;
        console.warn(`[db] connection attempt ${attempt}/10 failed: ${err.message} — retrying in 3 s…`);
        await new Promise(r => setTimeout(r, 3000));
      }
    }
    if (lastErr) {
      console.error("[db] FATAL — cannot connect to database:", lastErr.message);
      process.exit(1);
    }
  }

  // ─── Seed essential data (idempotent) ────────────────────────────────────
  try {
    await runSeed();
  } catch (err: any) {
    console.error("[seed] seed failed (non-fatal):", err.message);
  }

  // ─── Schema migrations (idempotent) ──────────────────────────────────────
  try {
    await runItemGroupsMigration();
  } catch (err: any) {
    console.error("[migration] item_groups migration failed (non-fatal):", err.message);
  }

  // ─── Backfill sizeSortValue for items missing it (idempotent) ────────────
  try {
    await backfillSizeSortValues();
  } catch (err: any) {
    console.error("[backfill] sizeSortValue backfill failed (non-fatal):", err.message);
  }

  await setupAuth(app);
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) return next(err);
    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    { port, host: "0.0.0.0", reusePort: true },
    () => { log(`serving on port ${port}`); },
  );
})();
