# ADR-002: Authentication, sessions and CSRF

**Status:** accepted · 2026-10-06

## Context

FR-2 and SEC-2 require short-lived access tokens with rotating refresh tokens in HttpOnly
cookies. SEC-10 requires CSRF protection. The MCP server (Week 3) must call the same API
without a browser.

## Decision

- **Access token:** HS256 JWT, 15 minutes. It is returned in the response body and kept
  **in memory only** in the web app, never in localStorage. It is sent as `Authorization: Bearer`.
- **Refresh token:** 48 random bytes in an `HttpOnly; SameSite=Strict` cookie scoped to
  `/api/v1/auth`. Only its SHA-256 hash is stored. Every refresh rotates it. Tokens belong to
  a _family_: presenting an already-rotated token revokes the whole family and is audited as
  theft (`auth.refresh_reuse`).
- **Every request re-reads the user** (role, disabled). A role change or disable takes effect
  at once, not after the token expires. The cost is one primary-key lookup.
- **CSRF:** double submit. A random CSRF token is set as an HttpOnly cookie and returned in
  the body. The client echoes it in `X-CSRF-Token` on state-changing requests. The check
  applies only when the request carries session cookies, because bearer-only clients (the
  MCP server) cannot be forged cross-site. Session-start endpoints (login, register, refresh,
  password reset) are exempt, because the client cannot hold a token yet after a reload. They
  are covered by SameSite=Strict and the CORS allow-list.
- **Same origin everywhere:** Vite proxies `/api` in development and nginx proxies it in
  Docker, so SameSite=Strict cookies work without cross-site configuration.

## Consequences

- A page reload costs one `/auth/refresh` call to restore the session.
- If the front end and API are ever deployed on different sites, cookies need
  `SameSite=None; Secure` and the CSRF check becomes essential (it is already in place).
