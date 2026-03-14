import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import MemoryStore from "memorystore";
import { RedisStore } from "connect-redis";
import { createClient } from "redis";

import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { setupPassport } from "./auth";
import { createServer } from "http";
import cors from "cors";

const app = express();
const httpServer = createServer(app);

// Allow Cross-Origin requests from the Tauri Desktop App or local dev environment
app.use(cors({
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow all origins (including tauri://localhost, http://tauri.localhost, etc.)
    callback(null, true);
  },
  credentials: true
}));

// Trust Railway's reverse proxy so secure cookies work over HTTPS
app.set("trust proxy", 1);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));


function buildSessionStore() {
  if (process.env.REDIS_URL) {
    const client = createClient({ url: process.env.REDIS_URL });
    client.on("error", (err: Error) => console.error("Redis error:", err));
    client.connect().catch((err: Error) => console.error("Redis connect error:", err));
    return new RedisStore({ client });
  }
  // Local dev fallback — no Redis required
  const MemoryStoreSession = MemoryStore(session);
  return new MemoryStoreSession({ checkPeriod: 86400000 });
}

app.use(
  session({
    store: buildSessionStore(),
    secret: process.env.SESSION_SECRET ?? "gradeint-dev-secret-change-in-prod",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    },
  })
);

// ── Passport ───────────────────────────────────────────────────────────────
setupPassport(app);

// ── Healthcheck (used by Railway) ───────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ status: "ok", uptime: process.uptime() }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
