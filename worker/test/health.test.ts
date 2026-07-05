import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("GET /api/health", () => {
  it("returns ok with worker + schema versions", async () => {
    const res = await SELF.fetch("https://example.com/api/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      versions: { worker: string; schema: string };
    };
    expect(body.ok).toBe(true);
    expect(body.versions.worker).toMatch(/^\d+\.\d+\.\d+$/);
    expect(body.versions.schema).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
