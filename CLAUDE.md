# CLAUDE.md — LearnLoop

Project memory for Claude Code sessions. Keep this file current: update **Status** and
**Next steps** at the end of every work session (and before a session runs out of budget).

## What this is

LearnLoop: AI-powered adaptive maths practice (grades 6–8) with student, teacher and admin
roles, an LLM agent and an MCP server. Spec: `~/Downloads/SRS.pdf` (requirement IDs FR-_, AI-_,
SEC-_, NFR-_, DATA-_, API-_, OPS-_, TST-_, DEL-*). Portfolio piece for the PlayPower Labs
Full-Stack Engineer role. Approved build plan: `~/.claude/plans/see-there-is-one-memoized-meerkat.md`.

## Stack and decisions

- npm workspaces monorepo (no pnpm on this machine). Node 20.
- `packages/shared`: Zod request schemas + response DTO types, shared by web and api. Build it
  first (`npm run build -w @learnloop/shared`); api and web import from its `dist`.
- `apps/api`: Express 4 + TypeScript (ESM) + Prisma 6 (Postgres) + Zod + ioredis.
  Build with tsup (`dist/server.js`, `dist/seed.js`); dev with `tsx watch`.
- `apps/web`: React 18 + Vite 5 + React Query 5 + Tailwind 3 + React Router 6 + recharts.
  Vite proxies `/api` to `localhost:4000`, so cookies are same-origin.
- `apps/mcp-server`: placeholder until Week 3.
- LLM: free provider. Gemini API free tier by default (`AI_PROVIDER=gemini`, `GEMINI_MODEL`),
  plus Ollama (local) and a mock provider (tests/CI). Code lives in `apps/api/src/services/ai/`.

## Conventions

- Routes are declared with `ApiModule.route({ method, path, access, body, params, query }, handler)`
  in `apps/api/src/lib/route.ts`. That single declaration does auth, role checks, Zod
  validation, and the OpenAPI doc (`/api/docs`). Routes → services (Prisma is the data layer).
- Object-level ownership checks live in `apps/api/src/services/access.ts` (SEC-3). Use them for every ID route.
- Errors: throw `AppError` (`apps/api/src/lib/errors.ts`). The client always gets `{code, message, requestId}`.
- Audit: `recordAudit()` in `services/audit.ts` is append-only and hash-chained; never update or delete rows.
- Auth: 15-minute access JWT in memory (web), rotating refresh token in an HttpOnly cookie
  `ll_refresh`, double-submit CSRF (`ll_csrf` cookie + `X-CSRF-Token` header).
- Adaptive rules are pure functions in `services/adaptive.ts` (FR-12: 2 right → +1, 2 wrong → −1).
- Web UI uses only components from `apps/web/src/components/ui.tsx` (design system, NFR-1).
  Every page needs loading, empty and error states (NFR-2).

## Demo accounts (after seeding)

Password for every account: `LearnLoop!2026`. `admin@learnloop.dev`, `teacher1@learnloop.dev`,
`teacher2@learnloop.dev`, `student1..30@learnloop.dev`. Join codes: `GRADE7AA`, `GRADE8BB`
(student1 is not enrolled, so the join flow can be demoed).

## Gotchas

- Migration folders must sort after `20261006122831_init`; Prisma refuses `migrate reset` from an AI agent without the user's explicit consent.
- Tests need the docker Postgres running (`docker compose -f infra/docker-compose.yml up -d postgres redis`).

## Commands

- `npm install` (root) · `npm run lint` · `npm run typecheck` · `npm test`
- `npm run db:migrate` · `npm run db:seed` (seed: `--reset` to recreate)
- `npm run dev` (api :4000 + web :5173; needs Postgres and Redis, see `infra/docker-compose.yml`)

## Status (update every session)

**Pass 1 (SRS Week 1 + Week 2): DONE on 2026-10-06.**

- Monorepo, shared schemas, Prisma schema + 2 migrations, seed (300 questions)
- API: auth (argon2id, JWT + rotating refresh, CSRF, rate limits), classes, questions, quizzes,
  assignments, adaptive practice, progress, admin, hash-chained audit log, OpenAPI at `/api/docs`
- Web: all student, teacher and admin pages plus profile; initial JS 46 KB gzip
- Tests: 149 passing (shared 15, api 128 at 85% line coverage, web 6); lint, typecheck, format, build green
- Docker: `docker compose -f infra/docker-compose.yml up --build` → http://localhost:8080 (verified)
- CI: ci.yml (lint/type/test/build, npm audit, gitleaks, Trivy), codeql.yml, dependabot.yml, PR template
- Docs: README, SECURITY.md, AI-WORKFLOW.md, ADR-001..003
- Browser walkthrough done for admin (users, audit verify), student (resume, answer, progress charts),
  and teacher (class dashboard). **Not verified:** mobile width in a real browser (window resize did not apply).
- Git: repo initialised on `main` with 13 logical commits (nothing pushed; no remote yet).
- `deepmerge-ts` overridden to ^8 in the root package.json to clear a Prisma high-severity advisory.

## UI redesign: DONE (2026-10-06)

The web UI was redesigned so it doesn't read as AI-generated. Rules and tokens live in
`docs/design.md`: an exercise-book look with paper, ink, a pencil-yellow highlight, and
`correct`/`incorrect` colours used only for marking. Fonts are Source Serif 4 and IBM Plex Sans/Mono,
self-hosted. Corners are small, rules replace shadows, and lists replace card grids.

- The Tailwind palette is **replaced**: only `paper`, `ink`, `rule`, `pencil`, `correct`, `incorrect` exist.
  Never name a colour after a utility (`right` clashed with `text-right`).
- Components (`components/ui.tsx`): Panel, PanelHeader, PageHeader(eyebrow), SectionTitle, StatStrip,
  Tag, Status, Meter, Alert, Code, TextArea. Component `tone` props still use the values `right`/`wrong`/`pencil`;
  they map to the `correct`/`incorrect`/`pencil` colour classes inside `ui.tsx`.
- Checked at 360 and 390 px with a Playwright script (scratchpad, not committed). All 11 pages
  have no horizontal overflow. Fixed a bug where sr-only text inside tables widened the page
  (`TableWrap` is now `relative`). Port this check into Week 4 E2E (TST-4/NFR-4).
- The Docker login rate limit (20 per IP / 10 per account per 15 min) trips during repeated
  browser checks. Clear local counters with:
  `docker exec learnloop-redis-1 sh -c "redis-cli --scan --pattern 'rl:*' | xargs -r redis-cli del"`

## Next steps

1. **Week 3, AI + MCP** (start here next session):
   - `services/ai/`: question generation (AI-1) with a Zod schema, 2 retries feeding back the
     validation error (AI-2); explanations under 120 words (AI-3); hints with no answer (FR-14);
     timeout, token cap and per-user daily limit (AI-5); log `AiCall` metadata only (AI-24); PII scrub (AI-20);
     user text wrapped as data (AI-21); versioned prompt files + ≥20 eval cases (AI-6).
   - Routes: `POST /ai/questions:generate` (teacher; creates DRAFT questions), `POST /ai/explain`, `/ai/hint`
     (streamed, NFR-9); wire FR-13 so wrong answers use the AI explanation with the static fallback.
   - Admin AI usage/cost page (FR-42). "AI-generated" label + report button (AI-7).
   - `apps/mcp-server`: official MCP TS SDK, 6 tools calling the REST API with a scoped token (AI-10..14);
     confirmation/draft for create_quiz and assign_practice; README connection guide.
   - Tests: TST-5 (≥20 malformed/hostile outputs), TST-6 (≥10 injection cases), TST-7 (MCP contract tests).
   - Get a free Gemini key at https://aistudio.google.com and check the current free model name.
2. **Week 4**: Playwright E2E + axe (TST-4, TST-9), k6 (TST-10), deploy (Vercel + Render), demo video, release tags.
3. Optional polish: verify 360 px layouts in a real browser.

## Session hand-off rule

When a session reaches ~90% of its token budget: stop starting new work, update **Status** and
**Next steps** above with exactly where things stand (including half-finished files), then ask
the user whether to continue now or in a new session.
