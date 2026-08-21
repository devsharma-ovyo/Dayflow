import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // In-memory persistent sync room store
  const syncStore = new Map<string, { updatedAt: number; payload: any }>();

  // API Route: Outlook Calendar ICS Proxy (handles webcal:// and https:// feeds without CORS issues)
  app.post("/api/outlook/feed", async (req, res) => {
    let feedUrl = (req.body?.url || "").trim();
    if (!feedUrl) {
      return res.status(400).json({ error: "Missing calendar feed URL" });
    }

    // Normalize webcal:// to https://
    if (feedUrl.startsWith("webcal://")) {
      feedUrl = "https://" + feedUrl.substring(9);
    } else if (feedUrl.startsWith("http://")) {
      feedUrl = "https://" + feedUrl.substring(7);
    }

    if (!feedUrl.startsWith("https://")) {
      return res.status(400).json({ error: "Invalid URL protocol. Must be https:// or webcal://" });
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const response = await fetch(feedUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) DayFlow/1.0",
          "Accept": "text/calendar, text/plain, */*"
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return res.status(response.status).json({ 
          error: `Outlook server returned HTTP ${response.status}: ${response.statusText}` 
        });
      }

      const icsText = await response.text();
      if (!icsText || !icsText.includes("BEGIN:VCALENDAR")) {
        return res.status(400).json({ 
          error: "The provided URL did not return a valid iCalendar (ICS) feed." 
        });
      }

      return res.json({ success: true, ics: icsText });
    } catch (err: any) {
      console.error("Failed to fetch Outlook ICS feed:", err);
      const isTimeout = err.name === "AbortError";
      return res.status(500).json({ 
        error: isTimeout ? "Connection timed out while reaching Outlook calendar feed." : (err.message || "Failed to fetch Outlook feed.") 
      });
    }
  });

  // API Route: Save Sync Room Data
  app.post("/api/sync/:code", (req, res) => {
    const code = (req.params.code || "").toUpperCase().trim();
    if (!code) {
      return res.status(400).json({ error: "Invalid sync code" });
    }

    const { tasks, settings, updatedAt } = req.body;
    syncStore.set(code, {
      updatedAt: updatedAt || Date.now(),
      payload: {
        version: 1,
        syncCode: code,
        updatedAt: updatedAt || Date.now(),
        tasks: Array.isArray(tasks) ? tasks : [],
        settings: settings || {}
      }
    });

    return res.json({ success: true, count: Array.isArray(tasks) ? tasks.length : 0 });
  });

  // API Route: Get Sync Room Data
  app.get("/api/sync/:code", (req, res) => {
    const code = (req.params.code || "").toUpperCase().trim();
    if (!code || !syncStore.has(code)) {
      return res.json({ exists: false, tasks: [], updatedAt: 0 });
    }

    const data = syncStore.get(code)!;
    return res.json({
      exists: true,
      ...data.payload
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`DayFlow App + Sync Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
