# AI workflow (DEL-5)

This file records how AI tools were used to build LearnLoop and how their output was checked.
Rule of thumb: AI writes drafts; nothing merges until a human has read it and a test proves it.

## Tools

| Tool                      | Used for                                                                |
| ------------------------- | ----------------------------------------------------------------------- |
| Claude Code (Claude Opus) | Planning from the SRS, scaffolding, implementation, tests, docs, review |

## How output was verified

- Every change ran through `npm run lint`, `npm run typecheck` and `npm test`. API tests use a real Postgres database, not mocks.
- Security-relevant code (auth, ownership checks, CSRF, audit) has negative tests that fail if the control is removed.
- The UI was checked in a real browser as a student, a teacher and an admin.

## Examples of AI output that was corrected

| What the AI produced                                                        | Problem found                                                                        | Fix                                                                                                                        |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Late joiners got class assignments by comparing target counts               | Fragile heuristic; wrong if a student left the class                                 | Explicit `assignments.whole_class` flag                                                                                    |
| Audit log `actor_id` as a foreign key with `ON DELETE SET NULL`             | Deleting a user would rewrite rows and break the hash chain                          | Plain column, not a foreign key                                                                                            |
| Migration for the audit trigger named with an early timestamp               | Sorted before `init` and failed on a fresh database                                  | Renamed to sort after `init`                                                                                               |
| Test expected one `refresh_reuse` audit entry                               | Code correctly audits every replay (two in the test)                                 | Test fixed, behaviour kept                                                                                                 |
| Helmet CSP for the API                                                      | Helmet merged its defaults into the locked-down policy                               | `useDefaults: false`                                                                                                       |
| nginx added a second CSP on proxied API responses                           | Two conflicting CSP headers                                                          | `add_header` in the `/api/` block stops inheritance                                                                        |
| First two UI designs (default template, then a themed "exercise book" look) | Both still looked AI-generated to the owner; the second was a concept, not a product | Rebuilt as a conventional app: sidebar shell, lesson-style practice screen, tabs, sortable tables, toasts (docs/design.md) |
| Practice screen refetched the next question with `invalidateQueries`        | Old question flashed before the new one                                              | `resetQueries`, so a loading state shows instead                                                                           |

## AI-assisted tests

All tests in this pass were drafted with AI assistance and then reviewed. The RBAC matrix
(`apps/api/test/rbac.test.ts`) is generated from the route table, so it cannot silently miss
a new endpoint.
