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
