# Security

## Reporting a vulnerability

Please do not open a public issue. Email the maintainer (see the GitHub profile) with steps to
reproduce. You will get a reply within 5 working days. All data in this project is synthetic.

## Threat model (SRS 6.3)

| Threat                                 | Main controls                                                             | Proven by                                  |
| -------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------ |
| Account takeover                       | Argon2id, rate limits, rotating refresh tokens with reuse detection       | `test/auth.test.ts`, `rateLimit.test.ts`   |
| A student reads another student's data | Server-side ownership checks on every ID route                            | `test/access.test.ts`, `test/rbac.test.ts` |
| Prompt injection through quiz text     | Week 3: user text passed as data, never as instructions; output validated | Week 3 tests (TST-6)                       |
| Leaked LLM key                         | Key only in env; sent in a header, never in a URL; logs redact secrets    | `config.ts`, `services/ai/gemini.ts`       |
| A vulnerable dependency                | npm audit, Dependabot, CodeQL, Trivy in CI                                | `.github/workflows/*`                      |
| Tampering with the audit trail         | Hash chain plus a DB trigger that blocks UPDATE and DELETE                | `test/admin.test.ts`                       |

## Controls and where they live

| ID     | Control                                                                                             | Code                                                       |
| ------ | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| SEC-1  | Argon2id (19 MiB, t=2), minimum 12 characters; constant-time login for unknown emails               | `apps/api/src/services/auth.ts`                            |
| SEC-2  | 15-minute JWT; refresh tokens hashed, rotated, family revoked on reuse and on logout                | `services/auth.ts`, `services/tokens.ts`                   |
| SEC-3  | Roles checked on every route; object ownership checks; the user is re-read every request            | `lib/route.ts`, `middleware/auth.ts`, `services/access.ts` |
| SEC-4  | Zod `.strict()` validation of body, params and query; unknown fields rejected                       | `packages/shared/src/schemas.ts`, `lib/route.ts`           |
| SEC-5  | Prisma only; the few raw queries use tagged templates (parameterised)                               | `services/audit.ts`, `services/progress.ts`                |
| SEC-6  | React escaping; no `dangerouslySetInnerHTML` anywhere                                               | `apps/web`                                                 |
| SEC-7  | Helmet (API CSP `default-src 'none'`), nginx CSP/HSTS/frame-deny for the web app, CORS allow-list   | `app.ts`, `infra/nginx.conf`                               |
| SEC-8  | Rate limits on Redis per IP and per account for login, signup and reset; join-code guessing limited | `middleware/rateLimit.ts`                                  |
| SEC-9  | Config validated at boot; `.env` git-ignored; gitleaks in CI; pino redacts tokens and cookies       | `config.ts`, `lib/logger.ts`                               |
| SEC-10 | SameSite=Strict cookies plus double-submit CSRF token                                               | `middleware/csrf.ts`, ADR-002                              |
| SEC-11 | `npm audit --audit-level=high`, CodeQL, Dependabot                                                  | `.github/workflows/ci.yml`, `codeql.yml`                   |
| SEC-12 | Multi-stage images, slim/unprivileged bases, non-root users, Trivy scan                             | `infra/*.Dockerfile`, CI `images` job                      |
| SEC-13 | One error shape `{code, message, requestId}`; internals only in server logs                         | `middleware/error.ts`                                      |
| SEC-14 | Append-only, hash-chained audit log; DB trigger; integrity check endpoint                           | `services/audit.ts`, migration `*_audit_append_only`       |
| SEC-15 | HTTPS and HSTS in deployment; backup encryption from the managed Postgres provider                  | Week 4 deployment                                          |

Other details:

- CSV export defuses spreadsheet formula injection (`csvCell` in `services/classes.ts`).
- The students' practice API never returns the answer or explanation before an answer is submitted.
- Password reset links are single-use, expire in 30 minutes, and only their hash is stored. The response is the same whether or not the email exists.

## OWASP Top 10 mapping (SRS 6.2)

| OWASP risk                           | How LearnLoop addresses it                                                                     | IDs                        |
| ------------------------------------ | ---------------------------------------------------------------------------------------------- | -------------------------- |
| A01 Broken access control            | Role and ownership checks, with generated negative tests                                       | SEC-3, FR-3                |
| A02 Cryptographic failures           | Argon2id, hashed tokens, TLS, no secrets in code                                               | SEC-1, SEC-9, SEC-15       |
| A03 Injection                        | Zod, Prisma, React escaping, CSV defusing, prompt guards (Week 3)                              | SEC-4, SEC-5, SEC-6, AI-21 |
| A04 Insecure design                  | This threat model, draft state for AI content, ADRs                                            | SEC-14, FR-31              |
| A05 Security misconfiguration        | Strict headers, non-root containers, CORS allow-list                                           | SEC-7, SEC-12              |
| A06 Vulnerable components            | npm audit, Dependabot, CodeQL, Trivy                                                           | SEC-11, OPS-6              |
| A07 Identification and auth failures | Short tokens, rotation and reuse detection, rate limits                                        | SEC-2, SEC-8               |
| A08 Software and data integrity      | Lockfile, `npm ci`, versioned CI actions, hash-chained audit log                               | OPS-5, OPS-7               |
| A09 Logging and monitoring           | Structured JSON logs with request IDs; audit of logins and failures                            | SEC-14, NFR-14             |
| A10 SSRF                             | The server fetches no user-supplied URLs; the only outbound call is to the configured LLM host | SEC-4                      |

## Known limitations

- `deepmerge-ts` is overridden to v8 to clear a high-severity advisory in Prisma 6's config
  loader (root `package.json` → `overrides`). Remove it when Prisma is upgraded.
- React Router 6 has a moderate advisory that affects only server-side rendering. LearnLoop
  renders only on the client.
