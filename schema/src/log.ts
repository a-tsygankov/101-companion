export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogSource = "worker" | "client";

/** Component versions carried on every log line and exchanged on connect. */
export interface ComponentVersions {
  schema: string;
  worker?: string;
  client?: string;
}

/** One structured log entry, shared by server and client. */
export interface LogEntry {
  ts: string;
  level: LogLevel;
  msg: string;
  source: LogSource;
  versions: ComponentVersions;
  corrId?: string;
  ctx?: Record<string, unknown>;
}
