import { SCHEMA_VERSION, type LogEntry, type LogLevel } from "@101/schema";
import { WORKER_VERSION } from "./version";
import type { Env } from "./env";

/**
 * Structured JSON logger. Every line is a LogEntry stamped with the worker +
 * schema versions and printed to console (ingested by Cloudflare observability).
 * Returns the entry so callers can also forward it to clients in later phases.
 */
export function createLogger(_env: Env, base: Record<string, unknown> = {}) {
  const versions = { worker: WORKER_VERSION, schema: SCHEMA_VERSION };

  function emit(level: LogLevel, msg: string, ctx?: Record<string, unknown>): LogEntry {
    const entry: LogEntry = {
      ts: new Date().toISOString(),
      level,
      msg,
      source: "worker",
      versions,
      ...(ctx ? { ctx: { ...base, ...ctx } } : Object.keys(base).length ? { ctx: base } : {}),
    };
    console.log(JSON.stringify(entry));
    return entry;
  }

  return {
    debug: (msg: string, ctx?: Record<string, unknown>) => emit("debug", msg, ctx),
    info: (msg: string, ctx?: Record<string, unknown>) => emit("info", msg, ctx),
    warn: (msg: string, ctx?: Record<string, unknown>) => emit("warn", msg, ctx),
    error: (msg: string, ctx?: Record<string, unknown>) => emit("error", msg, ctx),
  };
}
