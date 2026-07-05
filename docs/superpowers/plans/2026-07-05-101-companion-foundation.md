# 101 Companion — Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the 101-companion pnpm-workspaces monorepo as a deployable, tested "walking skeleton" — three independently versioned packages (`schema`, `worker`, `webapp`), each emitting its component versions, with CI that runs tests and enforces per-component version bumps.

**Architecture:** A pnpm monorepo. `@101/schema` is a source-only shared package (Zod + shared types + version). `@101/worker` is a Hono app on Cloudflare Workers exposing `/api/health` and a structured JSON logger that stamps every line with `{ worker, schema }` versions. `@101/webapp` is a React + Vite app (Cloudflare Pages) that renders its `{ client, schema }` versions. GitHub Actions runs path-filtered typecheck+test, deploys worker + Pages, runs a Playwright smoke E2E against the real preview deployment URL, and fails PRs that change a component without bumping its version.

**Tech Stack:** TypeScript (strict), pnpm workspaces, Hono, Cloudflare Workers + Pages, `@cloudflare/vitest-pool-workers`, React 18 + Vite, Vitest, Playwright, Node 20+.

---

## Roadmap context (this plan = Phase 1 of 6)

1. **Foundation** ← this plan
2. schema: rules engine + wire protocol + tests
3. worker core: `GameRoom` Durable Object + WebSocket fanout + log forwarding
4. counting pipeline: Gemini client + rules mapping + proof overlay + R2
5. webapp: score/round UI, camera capture, heap assignment, Console, WS client, E2E
6. polish: error/fallback paths, version banners, handoff docs

Design spec: [docs/superpowers/specs/2026-07-03-101-companion-design.md](../specs/2026-07-03-101-companion-design.md).

---

## Prerequisites (do once before Task 1)

- **Merge PR #1** (`chore/repo-baseline`) so `README.md` and `.gitignore` are on `main`, or ensure both exist locally. This plan assumes `.gitignore` already ignores `node_modules/`, `dist/`, `.wrangler/`, `.dev.vars*`, `test-results/`, `playwright-report/`.
- Node ≥ 20 and `corepack enable` (provides pnpm 9). Verify: `node -v` (≥20), `pnpm -v` (≥9).
- Work on a feature branch: `git checkout -b feat/foundation`.

## File structure created by this plan

```
package.json                       root workspace manifest + scripts
pnpm-workspace.yaml                workspace globs
tsconfig.base.json                 shared strict TS config
.editorconfig                      editor defaults
scripts/check-version-bump.mjs     per-component version-bump enforcer (Node, no deps)
scripts/check-version-bump.test.mjs  node:test unit tests for the enforcer
schema/package.json                @101/schema manifest (version 0.0.1)
schema/tsconfig.json
schema/vitest.config.ts
schema/src/version.ts              SCHEMA_VERSION
schema/src/log.ts                  LogEntry / LogLevel / ComponentVersions
schema/src/index.ts                barrel
schema/test/version.test.ts        version-sync test
worker/package.json                @101/worker manifest (version 0.0.1)
worker/tsconfig.json
worker/wrangler.toml               Worker config (vars + observability)
worker/vitest.config.ts            vitest-pool-workers (miniflare)
worker/src/env.ts                  Env bindings interface
worker/src/version.ts              WORKER_VERSION
worker/src/logger.ts               structured JSON logger (stamps versions)
worker/src/index.ts                Hono app + /api/health
worker/test/health.test.ts         health endpoint test
webapp/package.json                @101/webapp manifest (version 0.0.1)
webapp/tsconfig.json
webapp/index.html
webapp/vite.config.ts              vite + vitest (jsdom)
webapp/playwright.config.ts        E2E config (uses E2E_BASE_URL or local preview)
webapp/src/version.ts              CLIENT_VERSION
webapp/src/main.tsx                React entry
webapp/src/App.tsx                 renders versions
webapp/test/setup.ts               jest-dom
webapp/test/App.test.tsx           component + version-sync test
webapp/e2e/smoke.spec.ts           Playwright smoke
.github/workflows/deploy.yml       path-filtered test/deploy/E2E
.github/workflows/version-check.yml  runs the version-bump enforcer
```

---

## Task 1: Workspace root + shared tooling config

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.editorconfig`

- [ ] **Step 1: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - schema
  - worker
  - webapp
```

- [ ] **Step 2: Create root `package.json`**

```json
{
  "name": "companion-101",
  "version": "0.0.0",
  "private": true,
  "packageManager": "pnpm@9.12.0",
  "engines": { "node": ">=20" },
  "scripts": {
    "typecheck": "pnpm -r typecheck",
    "test": "pnpm -r test",
    "build": "pnpm -r --if-present build",
    "version-check": "node scripts/check-version-bump.mjs",
    "test:version-check": "node --test scripts/check-version-bump.test.mjs"
  },
  "devDependencies": { "typescript": "^5.6.0" }
}
```

- [ ] **Step 3: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "verbatimModuleSyntax": true,
    "noEmit": true
  }
}
```

- [ ] **Step 4: Create `.editorconfig`**

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2
trim_trailing_whitespace = true
```

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .editorconfig
git commit -m "chore: workspace root + shared tsconfig"
```

---

## Task 2: `@101/schema` package (version + log types)

**Files:**
- Create: `schema/package.json`, `schema/tsconfig.json`, `schema/vitest.config.ts`, `schema/src/version.ts`, `schema/src/log.ts`, `schema/src/index.ts`
- Test: `schema/test/version.test.ts`

- [ ] **Step 1: Create `schema/package.json`**

```json
{
  "name": "@101/schema",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": { "zod": "^3.23.0" },
  "devDependencies": { "typescript": "^5.6.0", "vitest": "~2.1.0" }
}
```

- [ ] **Step 2: Create `schema/tsconfig.json`**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": { "resolveJsonModule": true },
  "include": ["src/**/*", "test/**/*"]
}
```

- [ ] **Step 3: Create `schema/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({ test: { environment: "node" } });
```

- [ ] **Step 4: Create the source files**

`schema/src/version.ts`:

```ts
/** Bumped whenever the shared schema/protocol changes. Kept in sync with package.json. */
export const SCHEMA_VERSION = "0.0.1";
```

`schema/src/log.ts`:

```ts
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
```

`schema/src/index.ts`:

```ts
export { SCHEMA_VERSION } from "./version";
export type { LogLevel, LogSource, ComponentVersions, LogEntry } from "./log";
```

- [ ] **Step 5: Write the failing test**

`schema/test/version.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import pkg from "../package.json";
import { SCHEMA_VERSION } from "../src/version";

describe("SCHEMA_VERSION", () => {
  it("matches package.json version", () => {
    expect(SCHEMA_VERSION).toBe(pkg.version);
  });
});
```

- [ ] **Step 6: Install deps and run the test to verify it passes**

Run:
```bash
pnpm install
pnpm --filter @101/schema test
```
Expected: 1 passed. (If it fails, `SCHEMA_VERSION` and `schema/package.json` `version` disagree — fix `version.ts`.)

- [ ] **Step 7: Typecheck**

Run: `pnpm --filter @101/schema typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add schema pnpm-lock.yaml
git commit -m "feat(schema): version constant + shared log types"
```

---

## Task 3: `@101/worker` health endpoint + structured logger

**Files:**
- Create: `worker/package.json`, `worker/tsconfig.json`, `worker/wrangler.toml`, `worker/vitest.config.ts`, `worker/src/env.ts`, `worker/src/version.ts`, `worker/src/logger.ts`, `worker/src/index.ts`
- Test: `worker/test/health.test.ts`

- [ ] **Step 1: Create `worker/package.json`**

```json
{
  "name": "@101/worker",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@101/schema": "workspace:*",
    "hono": "^4.6.0"
  },
  "devDependencies": {
    "@cloudflare/vitest-pool-workers": "^0.5.0",
    "@cloudflare/workers-types": "^4.20250101.0",
    "typescript": "^5.6.0",
    "vitest": "~2.1.0",
    "wrangler": "^4.0.0"
  }
}
```

- [ ] **Step 2: Create `worker/wrangler.toml`**

```toml
name = "companion-101-api"
main = "src/index.ts"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]

[vars]
ENVIRONMENT = "development"
GEMINI_MODEL = "gemini-2.5-flash"

[observability]
enabled = true

# Later phases add: [[durable_objects.bindings]] GameRoom, [[r2_buckets]] IMAGES,
# and the GEMINI_API_KEY secret (via `wrangler secret put`).
```

- [ ] **Step 3: Create `worker/tsconfig.json`**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "types": ["@cloudflare/workers-types/2023-07-01"]
  },
  "include": ["src/**/*", "test/**/*", "vitest.config.ts"]
}
```

- [ ] **Step 4: Create `worker/vitest.config.ts`**

```ts
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.toml" },
      },
    },
  },
});
```

- [ ] **Step 5: Create the source files**

`worker/src/version.ts`:

```ts
/** Bumped whenever the worker changes. Kept in sync with package.json. */
export const WORKER_VERSION = "0.0.1";
```

`worker/src/env.ts`:

```ts
/** Worker bindings. Extended in later phases (GameRoom DO, IMAGES R2, GEMINI_API_KEY). */
export interface Env {
  ENVIRONMENT: string;
  GEMINI_MODEL: string;
}
```

`worker/src/logger.ts`:

```ts
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
```

`worker/src/index.ts`:

```ts
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
```

- [ ] **Step 6: Write the failing test**

`worker/test/health.test.ts`:

```ts
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
```

- [ ] **Step 7: Install and run the test to verify it passes**

Run:
```bash
pnpm install
pnpm --filter @101/worker test
```
Expected: 1 passed. (First run downloads the workerd runtime for miniflare — allow a minute.)

- [ ] **Step 8: Typecheck**

Run: `pnpm --filter @101/worker typecheck`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add worker pnpm-lock.yaml
git commit -m "feat(worker): /api/health + structured versioned logger"
```

---

## Task 4: `@101/webapp` skeleton + component test

**Files:**
- Create: `webapp/package.json`, `webapp/tsconfig.json`, `webapp/index.html`, `webapp/vite.config.ts`, `webapp/src/version.ts`, `webapp/src/main.tsx`, `webapp/src/App.tsx`, `webapp/test/setup.ts`
- Test: `webapp/test/App.test.tsx`

- [ ] **Step 1: Create `webapp/package.json`**

```json
{
  "name": "@101/webapp",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "deploy": "wrangler pages deploy dist --project-name=companion-101-webapp --branch=main"
  },
  "dependencies": {
    "@101/schema": "workspace:*",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.48.0",
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^25.0.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vitest": "~2.1.0",
    "wrangler": "^4.0.0"
  }
}
```

- [ ] **Step 2: Create `webapp/tsconfig.json`**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "test", "vite.config.ts"]
}
```

- [ ] **Step 3: Create `webapp/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>101 Companion</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Create `webapp/vite.config.ts`**

`@101/schema` ships raw TypeScript source (no build step). Vite does not transpile linked workspace deps by default, so alias the specifier to the source entry — this applies to both `vite build`/`dev` and Vitest (which reads this config), keeping runtime and tests consistent.

```ts
/// <reference types="vitest" />
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@101/schema": fileURLToPath(new URL("../schema/src/index.ts", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
  },
});
```

- [ ] **Step 5: Create the source files**

`webapp/src/version.ts`:

```ts
/** Bumped whenever the client changes. Kept in sync with package.json. */
export const CLIENT_VERSION = "0.0.1";
```

`webapp/src/App.tsx`:

```tsx
import { SCHEMA_VERSION } from "@101/schema";
import { CLIENT_VERSION } from "./version";

export function App() {
  return (
    <main>
      <h1>101 Companion</h1>
      <p data-testid="versions">
        client {CLIENT_VERSION} · schema {SCHEMA_VERSION}
      </p>
    </main>
  );
}
```

`webapp/src/main.tsx`:

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const el = document.getElementById("root");
if (!el) throw new Error("#root not found");
createRoot(el).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

`webapp/test/setup.ts`:

```ts
import "@testing-library/jest-dom";
```

- [ ] **Step 6: Write the failing tests**

`webapp/test/App.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import pkg from "../package.json";
import { App } from "../src/App";
import { CLIENT_VERSION } from "../src/version";

describe("App", () => {
  it("renders the client version", () => {
    render(<App />);
    expect(screen.getByTestId("versions")).toHaveTextContent(`client ${CLIENT_VERSION}`);
  });

  it("keeps CLIENT_VERSION in sync with package.json", () => {
    expect(CLIENT_VERSION).toBe(pkg.version);
  });
});
```

- [ ] **Step 7: Install and run the tests to verify they pass**

Run:
```bash
pnpm install
pnpm --filter @101/webapp test
```
Expected: 2 passed.

- [ ] **Step 8: Typecheck and production build**

Run:
```bash
pnpm --filter @101/webapp typecheck
pnpm --filter @101/webapp build
```
Expected: no type errors; `webapp/dist/` produced.

- [ ] **Step 9: Commit**

```bash
git add webapp pnpm-lock.yaml
git commit -m "feat(webapp): React+Vite skeleton rendering component versions"
```

---

## Task 5: Version-bump enforcer script (TDD, Node built-ins)

The enforcer fails when files under a component directory change without that component's `package.json` `version` increasing (vs the PR base). Doc-only changes (`*.md`) are exempt. Pure logic is unit-tested with `node:test`; no new dependencies.

**Files:**
- Create: `scripts/check-version-bump.mjs`
- Test: `scripts/check-version-bump.test.mjs`

- [ ] **Step 1: Write the failing test**

`scripts/check-version-bump.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { isBump, componentTouched, COMPONENTS } from "./check-version-bump.mjs";

test("isBump: higher version passes", () => {
  assert.equal(isBump("0.0.1", "0.0.2"), true);
  assert.equal(isBump("0.1.0", "0.2.0"), true);
  assert.equal(isBump("1.0.0", "1.0.1"), true);
});

test("isBump: same or lower version fails", () => {
  assert.equal(isBump("0.0.2", "0.0.2"), false);
  assert.equal(isBump("0.0.2", "0.0.1"), false);
});

test("componentTouched: ignores markdown, catches source", () => {
  const changed = ["worker/src/index.ts", "worker/README.md"];
  assert.equal(componentTouched(changed, "worker"), true);
});

test("componentTouched: markdown-only is not touched", () => {
  const changed = ["worker/README.md", "docs/x.md"];
  assert.equal(componentTouched(changed, "worker"), false);
});

test("COMPONENTS maps the three versioned packages", () => {
  assert.deepEqual(Object.keys(COMPONENTS).sort(), ["schema", "webapp", "worker"]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/check-version-bump.test.mjs`
Expected: FAIL — `Cannot find module './check-version-bump.mjs'`.

- [ ] **Step 3: Write the implementation**

`scripts/check-version-bump.mjs`:

```js
#!/usr/bin/env node
// Fails CI if a component's files changed (vs BASE_REF) without a version bump.
// Doc-only (*.md) changes are exempt. No dependencies.
import { execFileSync } from "node:child_process";

export const COMPONENTS = {
  schema: "schema/package.json",
  worker: "worker/package.json",
  webapp: "webapp/package.json",
};

export function isBump(baseVer, headVer) {
  if (!headVer) return false;
  const b = baseVer.split(".").map(Number);
  const h = headVer.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((h[i] ?? 0) > (b[i] ?? 0)) return true;
    if ((h[i] ?? 0) < (b[i] ?? 0)) return false;
  }
  return false;
}

export function componentTouched(changedFiles, component) {
  const prefix = component + "/";
  return changedFiles.some(
    (f) => f.startsWith(prefix) && !f.endsWith(".md"),
  );
}

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" });
}

function versionAt(ref, path) {
  try {
    return JSON.parse(git("show", `${ref}:${path}`)).version ?? null;
  } catch {
    return null; // file absent at that ref (e.g. brand-new component)
  }
}

function main() {
  const base = process.env.BASE_REF || "origin/main";
  const changed = git("diff", "--name-only", `${base}...HEAD`)
    .split("\n")
    .filter(Boolean);

  const failures = [];
  for (const [component, pkg] of Object.entries(COMPONENTS)) {
    if (!componentTouched(changed, component)) continue;
    const baseVer = versionAt(base, pkg);
    if (baseVer === null) continue; // new component — nothing to bump against
    const headVer = versionAt("HEAD", pkg);
    if (!isBump(baseVer, headVer)) {
      failures.push(
        `${component}: source changed but version ${baseVer} -> ${headVer} not bumped (${pkg})`,
      );
    }
  }

  if (failures.length) {
    console.error("Version-bump check FAILED:");
    for (const f of failures) console.error("  - " + f);
    process.exit(1);
  }
  console.log("Version-bump check passed.");
}

// Only run the git-driven check when invoked directly, not when imported by tests.
if (import.meta.url === `file://${process.argv[1]}`) main();
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test scripts/check-version-bump.test.mjs`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts package.json
git commit -m "chore(ci): add version-bump enforcer with unit tests"
```

---

## Task 6: CI workflows (test, deploy, E2E, version-check)

**Files:**
- Create: `.github/workflows/deploy.yml`, `.github/workflows/version-check.yml`

> The E2E job uses the **actual deployment URL** returned by `cloudflare/wrangler-action` (`steps.deploy.outputs.deployment-url`) as the Playwright base URL — never a URL reconstructed from the branch name — so branches containing `/` work correctly.

- [ ] **Step 1: Create `.github/workflows/version-check.yml`**

```yaml
name: Version-bump check

on:
  pull_request:
    branches: [main]

jobs:
  version-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: actions/setup-node@v4
        with: { node-version: "22" }
      - name: Run version-bump enforcer tests
        run: node --test scripts/check-version-bump.test.mjs
      - name: Enforce version bumps
        env:
          BASE_REF: origin/${{ github.base_ref }}
        run: node scripts/check-version-bump.mjs
```

- [ ] **Step 2: Create `.github/workflows/deploy.yml`**

```yaml
name: CI / Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: true

jobs:
  changes:
    runs-on: ubuntu-latest
    outputs:
      schema: ${{ steps.filter.outputs.schema }}
      worker: ${{ steps.filter.outputs.worker }}
      webapp: ${{ steps.filter.outputs.webapp }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            schema:
              - 'schema/**'
            worker:
              - 'worker/**'
              - 'schema/**'
            webapp:
              - 'webapp/**'
              - 'schema/**'

  test:
    needs: changes
    if: needs.changes.outputs.schema == 'true' || needs.changes.outputs.worker == 'true' || needs.changes.outputs.webapp == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: "22", cache: "pnpm" }
      - run: pnpm install --frozen-lockfile
      - run: pnpm -r typecheck
      - run: pnpm -r test

  worker-deploy:
    needs: [changes, test]
    if: github.event_name == 'push' && needs.changes.outputs.worker == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: "22", cache: "pnpm" }
      - run: pnpm install --frozen-lockfile
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          workingDirectory: worker
          command: deploy

  webapp-build:
    needs: changes
    if: needs.changes.outputs.webapp == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: "22", cache: "pnpm" }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @101/webapp build
      - uses: actions/upload-artifact@v4
        with: { name: webapp-dist, path: webapp/dist }

  webapp-preview-deploy:
    needs: [changes, webapp-build]
    if: github.event_name == 'pull_request' && needs.changes.outputs.webapp == 'true'
    runs-on: ubuntu-latest
    outputs:
      preview_url: ${{ steps.deploy.outputs.deployment-url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with: { name: webapp-dist, path: webapp/dist }
      - name: Deploy to Pages (branch preview)
        id: deploy
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          workingDirectory: webapp
          command: pages deploy dist --project-name=companion-101-webapp --branch=${{ github.head_ref }} --commit-dirty=true

  webapp-e2e:
    needs: [changes, webapp-preview-deploy]
    if: github.event_name == 'pull_request' && needs.changes.outputs.webapp == 'true'
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: webapp } }
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: "22", cache: "pnpm" }
      - run: pnpm install --frozen-lockfile
        working-directory: .
      - run: pnpm exec playwright install --with-deps chromium
      - name: Run E2E against branch preview
        env:
          E2E_BASE_URL: ${{ needs.webapp-preview-deploy.outputs.preview_url }}
        run: pnpm test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: playwright-report, path: webapp/playwright-report, retention-days: 7 }

  webapp-deploy:
    needs: [changes, test, webapp-build]
    if: github.event_name == 'push' && needs.changes.outputs.webapp == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with: { name: webapp-dist, path: webapp/dist }
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          workingDirectory: webapp
          command: pages deploy dist --project-name=companion-101-webapp --branch=main
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows
git commit -m "ci: path-filtered test/deploy + E2E on real preview URL + version-check"
```

---

## Task 7: Playwright smoke E2E + full local verification

**Files:**
- Create: `webapp/playwright.config.ts`, `webapp/e2e/smoke.spec.ts`

- [ ] **Step 1: Create `webapp/playwright.config.ts`**

```ts
import { defineConfig, devices } from "@playwright/test";

// In CI, E2E_BASE_URL points at the deployed preview. Locally, Playwright
// builds + serves the app itself via vite preview.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:4173";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  use: { baseURL, ...devices["Desktop Chrome"] },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "pnpm build && pnpm exec vite preview --port 4173 --strictPort",
        port: 4173,
        reuseExistingServer: !process.env.CI,
      },
});
```

- [ ] **Step 2: Write the smoke test**

`webapp/e2e/smoke.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("app renders and shows component versions", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "101 Companion" })).toBeVisible();
  await expect(page.getByTestId("versions")).toContainText("schema");
});
```

- [ ] **Step 3: Install the browser and run the smoke test locally**

Run:
```bash
pnpm --filter @101/webapp exec playwright install chromium
pnpm --filter @101/webapp test:e2e
```
Expected: 1 passed (Playwright builds the app, serves it on :4173, and asserts the heading + versions render).

- [ ] **Step 4: Run the entire workspace verification**

Run:
```bash
pnpm -r typecheck
pnpm -r test
node --test scripts/check-version-bump.test.mjs
```
Expected: typecheck clean; all Vitest suites (schema, worker, webapp) pass; enforcer tests pass.

- [ ] **Step 5: Commit**

```bash
git add webapp/playwright.config.ts webapp/e2e
git commit -m "test(webapp): Playwright smoke E2E for the walking skeleton"
```

- [ ] **Step 6: Open the PR**

```bash
git push -u origin feat/foundation
gh pr create --base main --title "Phase 1: monorepo foundation (schema/worker/webapp + CI)" \
  --body "Walking skeleton: three versioned packages, /api/health with versioned logging, versioned webapp, path-filtered CI with version-bump enforcement and E2E against the real preview URL."
```

Expected: `version-check` and `test` checks run and pass. Deploy jobs are skipped on PRs (they run on push to `main`).

---

## One-time infrastructure setup (outside this plan)

These are manual, done once by a maintainer with Cloudflare access; they are **not** code steps and cannot be tested locally:

1. Create the Cloudflare Pages project: `companion-101-webapp`.
2. Create the Worker on first `wrangler deploy` (name `companion-101-api`).
3. Add GitHub repo secrets: `CLOUDFLARE_API_TOKEN` (Workers + Pages edit), `CLOUDFLARE_ACCOUNT_ID`.
4. Gemini + R2 + Durable Object provisioning happens in Phases 3–4 (their plans cover `wrangler secret put GEMINI_API_KEY`, R2 bucket creation, and the DO migration tag).

---

## Definition of done (Phase 1)

- `pnpm -r typecheck && pnpm -r test` is green across all three packages.
- `GET /api/health` returns `{ ok: true, versions: { worker, schema } }`, verified by test.
- The webapp renders `client <v> · schema <v>`, verified by unit + E2E tests.
- Each package's `VERSION` constant is asserted equal to its `package.json` version.
- CI runs test + version-check on PRs; deploy jobs are wired for `main`.
- The version-bump enforcer has passing unit tests and is wired into `version-check.yml`.
```
