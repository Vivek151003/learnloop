# ADR-001: Stack and repository layout

**Status:** accepted · 2026-10-06

## Context

The SRS allows React or Angular, NestJS or Express, and Prisma or Drizzle. The project is
built by one developer in four weeks, and it has to show strong TypeScript, API, security
and testing practice to a reviewer reading the code.

## Decision

- **npm workspaces monorepo**: `apps/web`, `apps/api`, `apps/mcp-server`, `packages/shared`.
  npm is chosen because it ships with Node and needs no extra tool.
- **React + Vite + React Query + Tailwind** for the front end.
- **Express + Zod + Prisma** for the back end. Express keeps the request pipeline visible in
  a few files. NestJS decorators would hide the security-relevant parts (auth, validation,
  ownership checks) that reviewers will want to read.
- **Shared Zod schemas** (`packages/shared`). The web app validates forms with the same
  schemas the API enforces, so the two can never disagree (NFR-11).
- **One route declaration** (`ApiModule.route` in `apps/api/src/lib/route.ts`) carries
  access roles, schemas and the handler. It drives authentication, role checks, validation,
  the OpenAPI document and the generated RBAC test, so a route cannot be added without them.
- **Prisma is the data layer.** Services call Prisma directly instead of going through a
  repository layer. Prisma's query API already plays the repository role, and a second
  layer would add code without adding safety. Object-level access checks live in
  `services/access.ts`.

## Consequences

- One `npm install`, one lockfile, one CI job.
- `packages/shared` must be built before the api or web typecheck. The root scripts do this.
- If a second data store or heavy query logic appears, a repository layer can be introduced
  per module without changing routes.
