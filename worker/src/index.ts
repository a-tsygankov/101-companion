import { Hono } from "hono";
import { SCHEMA_VERSION } from "@101/schema";
import type { Env } from "./env";
import { WORKER_VERSION } from "./version";
import { createLogger } from "./logger";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => {
  createLogger(c.env).info("health check");
  return c.json({
    ok: true,
    versions: { worker: WORKER_VERSION, schema: SCHEMA_VERSION },
  });
});

export default app;
