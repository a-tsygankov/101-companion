import { describe, it, expect } from "vitest";
import pkg from "../package.json";
import { SCHEMA_VERSION } from "../src/version";

describe("SCHEMA_VERSION", () => {
  it("matches package.json version", () => {
    expect(SCHEMA_VERSION).toBe(pkg.version);
  });
});
