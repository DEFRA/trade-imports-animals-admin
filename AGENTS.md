# trade-imports-animals-admin

## Code quality

- A comment describes only the lines below it, and only when a name or extraction cannot. Never describe callers, other modules, the backend, a library, the UI or a test.
- No ticket keys, backlog, ruling or acceptance-criteria ids, release names or session vocabulary in code, comments or test titles.
- No history: no before/after narration, no `REMOVED_*`, no "renamed from".
- A name predicts its return value and side effects. No positional boolean flags, no metaphors. One concept, one name. A rename covers the concept's whole vocabulary.
- Set-up used by two tests goes in the shared helper. Promoting a helper deletes the local copies.
- Every branch that changes an outcome logs once, with the ids support searches by. Log `{ err }`, never only the message. No request or response bodies at INFO.
- A test title states what its assertions prove. A test must fail without the change it covers.
- `npm run lint` enforces the id, silent-catch and error-log rules through `eslint-rules/code-quality.js`.

Canonical text: `.claude/rules/code-quality.md` in the trade-imports-workspace repo.
