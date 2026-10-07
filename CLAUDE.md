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

## System design rule: build for more users (ALWAYS APPLY)

Every feature, endpoint, query or job must be designed so it keeps working when users grow from
30 students to many schools (target: 100k+ students, thousands at once, as in a full class logging
in at 9:00). Before writing code, ask: _what happens at 100× the data and 100× the traffic?_ In the
plan or PR, state the expected load and how the design copes.

**Principles**

- **Stateless API.** No per-user state in process memory. Sessions are JWTs plus DB/Redis, so any
  number of API instances can sit behind a load balancer. Shared state (rate limits, caches,
  locks) goes in Redis or Postgres, never in a module variable.
- **Every list is paginated** (`paginationSchema`, max 100). No unbounded `findMany` on tables that grow.
- **Every query uses an index.** A new `where`/`orderBy` column needs an `@@index` in
  `schema.prisma`. Avoid `OFFSET` on large tables; prefer keyset (cursor) pagination for feeds and logs.
- **No N+1.** Batch with `include`/`in` or `groupBy`; never query inside a loop over rows.
- **Precompute what's read often.** Values read much more than written (mastery, class summary)
  are stored or cached, not recalculated on every request. Caches need a TTL and an explicit
  invalidation point.
- **Slow or external work goes off the request path.** LLM calls, emails and exports run with
  timeouts, retries with backoff, and a queue (BullMQ on Redis) when they don't need an instant
  answer. Every external call has a timeout and a graceful fallback (NFR-10).
- **Idempotent and concurrency-safe writes.** Use conditional updates and unique constraints, as
  `submitAnswer` and refresh-token rotation already do, so retries and double clicks are safe.
- **Bounded resources.** Rate limits per user and IP; caps on body size, page size, LLM tokens
  and per-user daily AI usage (AI-5); DB connection pool sized per instance (use PgBouncer when
  instances × pool > Postgres `max_connections`).
- **Fast-growing tables are append-only and time-indexed** (`attempts`, `audit_logs`, `ai_calls`),
  so they can be partitioned by month or archived later without code changes.
- **Measure before optimising.** Keep the k6 test (TST-10) honest: p95 < 300 ms for non-AI
  endpoints at 100 concurrent users (NFR-7). Logs carry request IDs so slow paths can be traced.

**Known bottlenecks in the current code (fix before real scale; don't add more like them)**

| Where                                                                 | Issue at scale                                                               | Planned fix                                                               |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `services/audit.ts` `recordAudit`                                     | One global advisory lock serialises every audited write (every login).       | Chain per day or per actor shard, or write via a queue with one consumer  |
| `middleware/auth.ts` `authenticate`                                   | One DB read per request to re-check role and disabled.                       | Cache `{role, disabled}` in Redis (TTL ~60 s); invalidate on admin change |
| `services/practice.ts` `pickAdaptiveQuestion`                         | `count` + random `skip` is an OFFSET scan; slow on a large question bank.    | Random pick by indexed random key or a precomputed per-level ID pool      |
| `services/classes.ts` `classSummary`                                  | Several `groupBy` queries on every dashboard load.                           | Cache per class (short TTL) or maintain summary counters on answer        |
| `services/quizzes.ts` `listAssignments`, `listClasses`, `listQuizzes` | Not paginated (teacher view capped at 100).                                  | Add pagination like the other list endpoints                              |
| `services/audit.ts` `listAudit`, `progress.listAttempts`              | OFFSET pagination on the fastest-growing tables.                             | Keyset pagination on `seq` / `(created_at, id)`                           |
| `infra/api.Dockerfile` CMD                                            | Migrations and seed run on every container start; races with many replicas.  | Separate one-off migrate job in deploy (OPS-9); no seed in production     |
| `middleware/rateLimit.ts`                                             | Falls back to in-memory limits when Redis is missing, which is per instance. | Require `REDIS_URL` when `NODE_ENV=production`                            |

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
- Tests: 154 passing (shared 15, api 128 at 85% line coverage, web 11); lint, typecheck, format, build green
- Docker: `docker compose -f infra/docker-compose.yml up --build` → http://localhost:8080 (verified)
- CI: ci.yml (lint/type/test/build, npm audit, gitleaks, Trivy), codeql.yml, dependabot.yml, PR template
- Docs: README, SECURITY.md, AI-WORKFLOW.md, ADR-001..003
- Browser walkthrough done for admin (users, audit verify), student (resume, answer, progress charts),
  and teacher (class dashboard). **Not verified:** mobile width in a real browser (window resize did not apply).
- Git: repo initialised on `main` with 13 logical commits (nothing pushed; no remote yet).
- `deepmerge-ts` overridden to ^8 in the root package.json to clear a Prisma high-severity advisory.

## UI: conventional product design, v3 (2026-10-06)

The first two designs still read as AI-made (default indigo/Inter template, then a themed
"exercise book" look). v3 follows real product conventions. Rules, tokens and history are in
`docs/design.md`; read it before touching the UI.

- Palette is **replaced**: only `gray`, `brand` (blue), `success`, `danger`, `warning`. System font stack.
  Icons come from `lucide-react`. No gradients, no side-border cards, no decorative badges.
- App shell in `components/Layout.tsx` (sidebar, user menu, mobile drawer). The lesson screen
  (`/student/practice/:id`) is outside the shell, with a fixed bottom Check/Continue bar.
- Pages build only from `components/ui.tsx` plus `components/toast.tsx` (`useToast`). Tables use
  `SortTh` with `useSort` + `sortRows` (client-side) or server pagination (`Pager`).
- Every responsive `grid` needs `grid-cols-1` as the base, or it overflows on phones.
- Login/register show `apps/web/public/preview.jpg`, a real screenshot of the class dashboard.
  Recapture it (Playwright, 1280x800 at 1.5x) whenever the dashboard changes noticeably.
- Phone-width check: a Playwright script (kept in the session scratchpad, not in the repo) logs in
  as each role and checks `scrollWidth <= innerWidth` at 360 and 390 px on all pages. All 22 pass.
  Port it into Week 4 E2E (TST-4/NFR-4).
- The Docker login rate limit trips during repeated browser checks. Clear local counters with:
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
   - Scale (see the system design rule): cache explanations by `(questionId, normalised wrong answer)`
     in Redis/Postgres so repeated mistakes cost zero LLM calls; run question generation as a
     BullMQ job (teacher polls or gets the drafts when ready); enforce per-user daily caps in Redis;
     the free Gemini tier is rate-limited, so queue and back off instead of failing requests.
   - Get a free Gemini key at https://aistudio.google.com and check the current free model name.
2. **Week 4**: Playwright E2E + axe (TST-4, TST-9), k6 (TST-10), deploy (Vercel + Render), demo video, release tags.
3. Optional polish: verify 360 px layouts in a real browser.

## Session hand-off rule

When a session reaches ~90% of its token budget: stop starting new work, update **Status** and
**Next steps** above with exactly where things stand (including half-finished files), then ask
the user whether to continue now or in a new session.
