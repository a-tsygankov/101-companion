#!/usr/bin/env node
// Fails CI if a component's files changed (vs BASE_REF) without a version bump.
// Doc-only (*.md) changes are exempt. No dependencies.
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

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

// Run the git-driven check only when invoked directly (cross-platform-safe),
// not when imported by the test module.
if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
