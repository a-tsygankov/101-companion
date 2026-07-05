# 101 Companion

A mobile-first companion for the card game **101**. It keeps score across rounds
for multiple players on synced devices, and counts each losing player's leftover
cards after a round from a **single photo** of the table — using a free-tier
vision model (Gemini) that recognizes the cards while the app applies the game's
configured rules to score them.

The game ends when a player reaches the score limit (default **101**); that
player **loses**.

## Status

Pre-implementation. The approved design is the source of truth:

- [docs/superpowers/specs/2026-07-03-101-companion-design.md](docs/superpowers/specs/2026-07-03-101-companion-design.md)

## Planned architecture

A pnpm-workspaces monorepo with three independently versioned components:

| Component | Role |
|-----------|------|
| `schema/` | Shared Zod schemas, wire protocol, and the data-driven scoring rules engine |
| `worker/` | Hono on Cloudflare Workers + a `GameRoom` Durable Object (multi-device sync), R2 image storage, and the Gemini card-counting pipeline |
| `webapp/` | React + Vite responsive client (score/round UI, camera capture, live sync, log Console), deployed to Cloudflare Pages |

TypeScript (strict), Vitest + Playwright, GitHub Actions with per-component
version-bump enforcement, and server→client log forwarding. Stack and infra
patterns are adapted from the sibling `howler` repo.

See the design spec for the full architecture, data model, counting pipeline,
and testing strategy.
