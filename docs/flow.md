# Request flow: login → a student taking a practice set

This traces one concrete path through the running system, file by file, from opening the site to seeing the result of a practice set. Code references are `file:line`.

## 1. Login

**Student submits the login form** → `apps/web/src/pages/auth/LoginPage.tsx` calls `useAuth().login()`.

`apps/web/src/lib/auth.tsx:53` → `api.post('/auth/login', input)` → `apps/web/src/lib/api.ts:100-104` sends `POST /api/v1/auth/login` with `credentials: 'same-origin'` (so any `Set-Cookie` the response carries is accepted).

Server side: `apps/api/src/routes/auth.ts:38-49`. The route is rate-limited per-IP and per-account (`authLimiters`, Redis-backed) before it reaches the handler. It calls `auth.login(body, req.ip)` in `apps/api/src/services/auth.ts:76-90`:

1. Look up the user by email.
2. `argon2.verify` the password against the stored hash — **or**, if the email doesn't exist, verify against a cached dummy hash instead (`getDummyHash`, `services/auth.ts:22-23`) so a nonexistent email takes the same time as a wrong password and can't be distinguished by timing.
3. If the account is `disabled`, reject with 403 even though the password was right.
4. Write an audit row (`auth.login`, hash-chained).
5. `issueSession()` (`services/auth.ts:43-59`): creates a `RefreshToken` row (new `familyId`, hashed, 30-day expiry by default), signs a 15-minute HS256 access JWT (`services/tokens.ts:20-28`), and generates a fresh CSRF token.

Back in the route (`routes/auth.ts:18-21`), `respond()` sets two cookies — `ll_refresh` (HttpOnly, `SameSite=Strict`, path scoped to `/api/v1/auth` only) and `ll_csrf` (HttpOnly, `SameSite=Strict`, path `/`) — and returns `{ user, accessToken, csrfToken }` as the JSON body.

The browser now holds the refresh token only as an HttpOnly cookie (JS can't read it). The web app's `setSession()` (`lib/api.ts:26-29`) keeps the **access token and CSRF token in memory only** — never `localStorage` — specifically so an XSS payload that can run JS still can't read a long-lived or replayable credential out of storage.

`AuthProvider.start()` (`lib/auth.tsx:43-47`) stores the session and sets `user`, and the app routes to `/student`, `/teacher` or `/admin/users` depending on role (`homeFor`, `lib/auth.tsx:85-86`).

## 2. Every subsequent request: how the server knows who's asking

`apps/api/src/middleware/auth.ts:11-26` runs on every protected route:

1. Require an `Authorization: Bearer <token>` header (the web client attaches it automatically, `lib/api.ts:77`).
2. Verify the JWT signature, issuer, audience and expiry (`services/tokens.ts:30-48`).
3. **Re-read the user from the DB on every single request** (`id, role, disabled` only) rather than trusting the JWT's claims as-is. This is deliberate: if an admin disables an account or changes someone's role, that takes effect on their very next API call, not up to 15 minutes later when their access token would otherwise expire.
4. `requireRole(...)` (`middleware/auth.ts:29-35`) then checks the route's declared allowed roles against `req.user.role`.

Mutating requests (`POST`/`PATCH`/`DELETE`) also carry an `X-CSRF-Token` header (`lib/api.ts:78`) which a CSRF middleware compares against the `ll_csrf` cookie — a cross-site form or script can trigger the cookie to be sent automatically, but can't read its value to put in the header, so a forged cross-site request fails that check even with valid session cookies.

**Access token expiry (silent refresh):** if any request comes back `401`, `request()` (`lib/api.ts:87-98`) calls `refreshSession()` once, which does `POST /auth/refresh` with no body — the browser sends the `ll_refresh` cookie automatically. The server (`services/auth.ts:96-128`) looks up the token by its hash, and:
- if it was already rotated/revoked and is presented again → treats it as token theft, revokes the *entire family*, and forces a fresh login (`auth.refresh_reuse` audit entry);
- otherwise atomically marks it revoked and issues a new access + refresh token pair in the same family (`issueSession(stored.user, stored.familyId)`), so the original failed request is retried exactly once with the new token. If refresh itself fails, `onSessionExpired()` fires and the app drops back to the login screen.

On a hard page reload, the same `refreshSession()` call runs once on mount (`AuthProvider`'s `useEffect`, `lib/auth.tsx:31-35`) to silently restore the session from the cookie alone, which is why a reload doesn't bounce a logged-in student to the login page.

## 3. The refresh-token and password-reset cycle, step by step

This is the full lifecycle of the two tables `refresh_tokens` and `password_reset_tokens`, naming exactly which file and function is responsible for each step.

### A. Login issues the refresh token

**Job done by:** `issueSession()` in `apps/api/src/services/auth.ts:43-59`, called from `login()` at `apps/api/src/services/auth.ts:76-90`.

```ts
// apps/api/src/services/auth.ts:43-59
async function issueSession(user: User, familyId: string = randomUUID()): Promise<IssuedSession> {
  const refreshToken = randomToken(48);
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      familyId,
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(Date.now() + config.REFRESH_TOKEN_TTL_DAYS * 86_400_000),
    },
  });
  return {
    user: toUserDto(user),
    accessToken: signAccessToken({ sub: user.id, role: user.role }),
    refreshToken,
    csrfToken: randomToken(),
  };
}
```

A random 48-byte token is generated, only its hash goes into the `refresh_tokens` table, and a fresh `familyId` is minted (every token that descends from this login, through every later rotation, will carry this same `familyId`).

**Job done by:** `setSessionCookies()` in `apps/api/src/services/tokens.ts:57-61`, called from `respond()` in `apps/api/src/routes/auth.ts:18-21`. This is what puts the raw token into the `ll_refresh` HttpOnly cookie — the only place the raw token ever exists outside the request that created it.

### B. Normal use — the refresh token sits untouched

While the access token (15 min) is valid, no request touches `refresh_tokens` at all. The check on every request is `authenticate()` in `apps/api/src/middleware/auth.ts:11-26`, which only looks at the JWT and the `users` table.

### C. Access token expires → rotation

**Job done on the browser side by:** `request()` in `apps/web/src/lib/api.ts:87-98` — it's the `401` branch that notices the access token died and calls `refreshSession()` (`apps/web/src/lib/api.ts:38-56`), which sends `POST /auth/refresh` with the `ll_refresh` cookie attached automatically by the browser.

**Job done on the server side by:** `refresh()` in `apps/api/src/services/auth.ts:96-128`.

```ts
// apps/api/src/services/auth.ts:118-127
// Conditional update so two concurrent refreshes cannot both succeed.
const revoked = await prisma.refreshToken.updateMany({
  where: { id: stored.id, revokedAt: null },
  data: { revokedAt: new Date() },
});
if (revoked.count === 0) {
  await revokeFamily(stored.familyId);
  throw unauthorized('Refresh token reuse detected; please log in again', 'TOKEN_REUSE');
}
return issueSession(stored.user, stored.familyId);
```

The token just presented is looked up by its hash, marked `revokedAt`, and `issueSession()` (same function as step A) is called again — but this time passed the *existing* `familyId`, so the new token is recorded as part of the same lineage rather than starting a new one. The caller gets back a brand-new access token **and** a brand-new refresh token, and the one that was just presented can never be used again.

### D. Theft detection — a revoked token gets presented again

**Job done by:** the same `refresh()` function, the branch above the rotation logic:

```ts
// apps/api/src/services/auth.ts:104-112
if (stored.revokedAt) {
  await revokeFamily(stored.familyId);
  await recordAudit({
    actorId: stored.userId,
    action: 'auth.refresh_reuse',
    metadata: { familyId: stored.familyId },
  });
  throw unauthorized('Refresh token reuse detected; please log in again', 'TOKEN_REUSE');
}
```

If the token's row already has `revokedAt` set — meaning it was already rotated once — showing it again can only mean two different parties hold a copy of it. `revokeFamily()` (`apps/api/src/services/auth.ts:138-143`) sets `revokedAt` on **every** row sharing that `familyId`, killing the whole chain, and an `auth.refresh_reuse` row is written to `audit_logs` so this is visible later. Both the legitimate user and whoever stole the token are forced back to a real password login.

### E. Logout — the refresh token is torn up on purpose

**Job done by:** `logout()` in `apps/api/src/services/auth.ts:130-136`, route at `apps/api/src/routes/auth.ts:69-82`.

```ts
// apps/api/src/services/auth.ts:130-136
export async function logout(presented: string | undefined): Promise<void> {
  if (!presented) return;
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(presented) } });
  if (!stored) return;
  await revokeFamily(stored.familyId);
  await recordAudit({ actorId: stored.userId, action: 'auth.logout' });
}
```

Same `revokeFamily()` helper as the theft case — logout is just a voluntary version of the same action.

### F. Forgot password — requesting the link

**Job done by:** `requestPasswordReset()` in `apps/api/src/services/auth.ts:153-170`, route at `apps/api/src/routes/auth.ts:83-97`.

```ts
// apps/api/src/services/auth.ts:153-170
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.disabled) return;
  const token = randomToken(32);
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS), // 30 minutes
    },
  });
  const link = `${config.APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
  await sendMail({ to: user.email, subject: 'Reset your LearnLoop password', text: `...${link}...` });
}
```

Note the function returns the same way (nothing, no error) whether or not the email matches an account — that's what stops this endpoint being used to check which emails are registered.

### G. Forgot password — redeeming the link

**Job done by:** `resetPassword()` in `apps/api/src/services/auth.ts:172-194`, route at `apps/api/src/routes/auth.ts:98-110`.

```ts
// apps/api/src/services/auth.ts:172-194
export async function resetPassword(token: string, password: string): Promise<void> {
  const stored = await prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
    throw new AppError(400, 'INVALID_RESET_TOKEN', 'This reset link is invalid or has expired');
  }
  const passwordHash = await hashPassword(password);
  const used = await prisma.$transaction(async (tx) => {
    const marked = await tx.passwordResetToken.updateMany({
      where: { id: stored.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (marked.count === 0) return false; // already redeemed by a concurrent request
    await tx.user.update({ where: { id: stored.userId }, data: { passwordHash } });
    return true;
  });
  if (!used) throw new AppError(400, 'INVALID_RESET_TOKEN', 'This reset link has already been used');
  await revokeAllForUser(stored.userId);
  await recordAudit({ actorId: stored.userId, action: 'auth.password_reset' });
}
```

The token lookup, the "already used" check, and the actual password change happen inside one `$transaction`, guarded by `updateMany({ where: { usedAt: null } })` — so if the link is opened twice at once, only the first request's write survives and the second gets "already used" instead of silently changing the password twice.

### H. The tie-back — resetting a password kills existing sessions

**Job done by:** `revokeAllForUser()` in `apps/api/src/services/auth.ts:145-150`, called at the end of `resetPassword()` (step G, line 192).

```ts
// apps/api/src/services/auth.ts:145-150
export async function revokeAllForUser(userId: string) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
```

This is the one line connecting the two tables: redeeming a `password_reset_tokens` row doesn't just change the password, it also revokes **every** row that user has in `refresh_tokens`. Without this, someone who'd stolen a session would keep their refresh token working right through a password reset, since a refresh token isn't derived from the password at all.

### One cycle, two tables, in order

```
login            → refresh_tokens:  1 row created                      (auth.ts:43-59)
every 15 min     → refresh_tokens:  old row revoked, new row created    (auth.ts:96-128)
token reused     → refresh_tokens:  every row in the family revoked     (auth.ts:138-143)
logout           → refresh_tokens:  every row in the family revoked     (auth.ts:130-136)

forgot password  → password_reset_tokens: 1 row created                 (auth.ts:153-170)
reset redeemed   → password_reset_tokens: that row marked used          (auth.ts:181-186)
                 → refresh_tokens:        every row for that user killed (auth.ts:145-150, called at 192)
```

## 4. Dashboard load

`StudentHome` (`apps/web/src/pages/student/StudentHome.tsx`) fires several independent React Query calls in parallel on mount: `GET /topics`, `GET /students/:id/progress`, `GET /practice/sessions` (for "resume" detection), `GET /assignments`, `GET /classes`. Each is its own cached query key, so switching tabs or coming back to the page doesn't necessarily refetch everything.

`UpNext` (`StudentHome.tsx:162-229`) decides what to surface first: an **unfinished, non-assignment session** takes priority (resume it); otherwise the topic with the lowest mastery score is suggested.

## 5. Starting (or resuming) a practice session

Clicking a topic card or "Start practice" calls `useStartSession()` → `POST /practice/sessions` with either `{ topicId }` or `{ assignmentId }` (`StudentHome.tsx:42-53`).

Server: `startSession()` in `apps/api/src/services/practice.ts:62-130`. Two paths:

- **Free topic practice:** if an open (`completedAt: null`), non-assignment session already exists for that topic, it's returned as-is (`resumed: true`) rather than starting over. Otherwise a new `PracticeSession` is created with `totalQuestions = 10` and a **starting difficulty derived from existing mastery** (`startingDifficulty()`, `services/adaptive.ts:41-46`): no history → level 2; mastery < 0.4 → level 2; < 0.7 → level 3; otherwise level 4. A brand-new student isn't thrown at level 1 *or* level 5 — the first question is already calibrated to what's known about them.
- **Assigned quiz:** looks up the student's `AssignmentTarget` row. If it's already completed, 409. If an open session for that assignment exists, resume it. Otherwise create a session pinned to that quiz's first question's difficulty, with `totalQuestions` equal to the quiz's question count.

The response navigates the browser to `/student/practice/:sessionId` (`StudentHome.tsx:50`), which renders **outside** the normal sidebar `Layout` (`App.tsx`) — a full-screen, distraction-free lesson view.

## 6. Serving one question at a time

`PracticePage` (`apps/web/src/pages/student/PracticePage.tsx:37-41`) calls `GET /practice/sessions/:id/next` with `staleTime: Infinity` (it's only ever refetched by an explicit reset, never silently in the background while the student is mid-question).

Server: `nextQuestion()` (`services/practice.ts:196-229`):

1. Load the session and check it belongs to the caller (`loadOwnSession`, `services/practice.ts:48-56` — a 403 if another student's session id is probed).
2. If `currentQuestionId` is already set, that question is re-served as-is — this is what makes a session resumable: closing the tab mid-question and coming back doesn't skip or reroll it.
3. Otherwise, pick one:
   - **Assignment session** → next question in the quiz's fixed order, by `position`, offset by how many have been answered so far (`pickAssignmentQuestion`, `services/practice.ts:176-189`).
   - **Free practice** → `pickAdaptiveQuestion()` (`services/practice.ts:146-174`): an `approved` question in this topic, at the session's current difficulty, excluding every question already attempted in *this* session (so a 10-question set doesn't repeat a question), chosen with a random `OFFSET` pick among the matches. If nothing matches at the exact difficulty, it widens the band (±1, ±2, ±4) before giving up and ending the session early.
   - The question is written onto the session with a conditional update (`updateMany` guarded by `currentQuestionId: null`) specifically so two browser tabs open on the same session can't each get handed a *different* question for the same slot.
4. The question sent to the client (`toPracticeQuestion`, `services/practice.ts:35-44`) **never includes `correctAnswer` or `explanation`** — those only exist in the DB row and are withheld until the student answers.

## 7. Answering

The student picks an option (keyboard A–D also works, `PracticePage.tsx:163-174`) or types a number, then hits **Check**. That fires `POST /practice/sessions/:id/answer` with `{ questionId, answer, timeMs }` (`PracticePage.tsx:147-155`) — `timeMs` is measured client-side from when the question first rendered.

Server: `submitAnswer()` (`services/practice.ts:232-311`):

1. Re-verifies ownership and that `currentQuestionId` still matches the submitted `questionId` — if the student answered a question that isn't the one currently active (stale tab, replay), that's a 409, not silently accepted.
2. **Grades the answer server-side**, never trusting anything the client claims about correctness (`isAnswerCorrect()`, `services/adaptive.ts:48-60`) — exact string match (case/whitespace-insensitive) for multiple choice, numeric parse-and-compare with a small epsilon for numeric answers (so `0.5` and `1/2` and `0.50` all match).
3. Computes the next difficulty — **only for free practice**; an assigned quiz's difficulty never adapts mid-quiz (`services/practice.ts:246-248`). The rule (`nextDifficulty()`, `services/adaptive.ts:16-27`): two correct in a row at the current level bumps difficulty up by one and resets the streak counter; two wrong in a row drops it by one; difficulty is clamped to 1–5.
4. Everything else happens in **one DB transaction** (`services/practice.ts:254-299`):
   - Conditionally update the session (clear `currentQuestionId`, bump `answeredCount`/`correctCount`, write the new difficulty/streak, and set `completedAt` if this was the last question) — guarded so a double-submit of the same answer is a no-op, not a double count.
   - Insert the immutable `Attempt` row.
   - Upsert `Mastery` for that topic using an EWMA (`updateMastery()`, `services/adaptive.ts:34-38`): weight on the new result is `max(0.2, 1/(attempts+1))`, so mastery moves fast for a brand-new topic and more slowly once there's history — one lucky or unlucky answer can't swing an established score far.
   - If this was the last question of an assigned quiz, mark the `AssignmentTarget` completed.
5. Returns `{ correct, correctAnswer, explanation, previousDifficulty, newDifficulty, session }`. The explanation returned today is the question's **static, pre-written explanation** (`explanationSource: 'static'`) — this is the designed fallback; Week 3 swaps in a live AI-generated explanation behind the same field.

The UI (`PracticePage.tsx:283-371`) turns the bottom bar green or red, shows the explanation and (if it changed) an up/down arrow with the old → new difficulty, then **Continue** resets the query so the next `GET .../next` call fetches the next question — repeating step 5 until `answeredCount === totalQuestions`.

## 8. Finishing

When `GET .../next` returns `question: null` (session already `completedAt`), the page renders `Summary` (`PracticePage.tsx:376-429`) instead of a question: final score, a message that previews what the *next* session will do differently (start a level higher/lower based on this set's score), and — for free practice only — a one-click "practise again" that re-runs step 4 from scratch, now informed by the mastery just written.

The practice, progress, and assignment queries are invalidated on every answer (`PracticePage.tsx:99-101`) so the dashboard's stat cards and the teacher's class view reflect the attempt immediately, without a page reload.

## Summary of the guarantees this flow relies on

- **Nothing about correctness or difficulty is decided client-side** — the server grades, adapts, and persists; the client only displays.
- **Session state lives in the DB, not in client memory**, so a resume after closing the tab reproduces the exact same in-flight question.
- **Every state-changing update is a conditional/transactional write**, so double-submits, two tabs, or a retried request after a dropped connection can't double-count an answer or hand out two different questions for one slot.
- **The access token is short-lived and re-validated against the live user row**, so a disabled account or a role change is enforced immediately, not whenever the token happens to expire.
