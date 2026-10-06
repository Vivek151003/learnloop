## What and why

<!-- What does this change, and which SRS requirement IDs does it address (e.g. FR-12, SEC-3)? -->

## How it was tested

<!-- Commands run, screenshots for UI changes. -->

## Checklist

**Security**

- [ ] New routes declare `access` roles and Zod schemas (`ApiModule.route`)
- [ ] Every route that takes an ID uses an ownership check from `services/access.ts`
- [ ] No secrets, tokens or student text in code, logs or prompts
- [ ] Sensitive actions call `recordAudit()`

**Quality**

- [ ] Tests added or updated; `npm test` passes
- [ ] New screens have loading, empty and error states and work at 360 px
- [ ] Keyboard and screen-reader friendly (labels, focus, live regions)

**AI-generated code** (DEL-6)

- [ ] I have read every AI-generated line in this PR and can explain it
- [ ] AI-written tests were checked to fail when the code is broken
- [ ] AI suggestions I rejected or corrected are noted in `AI-WORKFLOW.md` if they are instructive
