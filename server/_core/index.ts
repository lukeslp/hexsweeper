import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));
  app.set("trust proxy", 1);

  // Apple App-Site Association for Universal Links into the iOS app.
  // Apple requires the bare filename (no .json extension) served as
  // application/json. The same content resolves at every brand domain
  // because Caddy reverse-proxies all six (hivemind.cx, hive-mind.pro,
  // hexmind.app/io, hexpand.app, hexpander.app) into this Node process.
  // Long-term: mirror to Cloudflare Workers; this remains origin-of-truth
  // for Apple's weekly bot crawl.
  app.get("/.well-known/apple-app-site-association", (_req, res) => {
    res.type("application/json").json({
      applinks: {
        details: [
          {
            appIDs: ["596T7J7FB6.app.hexmind.ios"],
            components: [
              { "/": "/", comment: "main entry — opens app" },
              { "/": "/?*", comment: "preserve query strings" },
              { "/": "/privacy*", exclude: true, comment: "legal stays in browser" },
              { "/": "/terms*", exclude: true },
            ],
          },
        ],
      },
      webcredentials: {
        apps: ["596T7J7FB6.app.hexmind.ios"],
      },
    });
  });

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
