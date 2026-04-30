# MAINTENANCE.md — Procedure for the scheduled health-check agent

This file is the runbook the scheduled agent follows on each invocation. Read
this whole file before doing anything. Read [CLAUDE.md](./CLAUDE.md) for
architecture and the "Common task playbook" section for fix patterns.

## Goal

Keep the library compatible with the live YouTube site by detecting layout
shifts and patching `src/paths.json` automatically. The agent runs
periodically; **most runs should be no-ops** (tests pass, exit clean).

## Hard policies

These are non-negotiable. If you can't satisfy them, exit without making
changes.

1. **Never commit if any test is failing.** Run `npm test` (full suite) at the
   end and verify exit code 0 and `pass` count equal to total. No commits
   otherwise.
2. **Never make changes when tests are passing.** A green baseline = do
   nothing. Exit clean.
3. **Never confuse a YouTube outage / proxy failure with a real breakage.**
   See the triage rules in step 2 below.
4. **Give up gracefully.** Hard limits below. When you hit one, exit
   without committing — do not retry on the next scheduled run by piling
   up partial work.
5. **JSON-only fixes preferred.** Most layout shifts are fixable by editing
   `src/paths.json`. If a fix would require new code (e.g. a new transform,
   a new pagination strategy type, a new resolver operator), give up and
   exit — that needs a human-driven release with version bump.
6. **Push directly to `main`** (this is explicit policy for this repo).
   Do not open PRs.

## Hard limits (give up if exceeded)

- **Max fix attempts:** 3. Each attempt = edit + verify pass.
- **Max wall-clock time:** 30 minutes from start.
- **Max network retries per test run:** 3 with 30-second backoff between.

## Procedure

### Step 1 — Baseline check

Run `npm test`. Capture stdout + stderr + exit code.

- **Exit code 0, all tests pass:** done. Exit clean. **No commit, no
  changes.** This is the expected outcome for most runs.
- **Exit code non-zero:** continue to step 2.

### Step 2 — Triage: real breakage vs. transient

Re-run `npm run test:integration` up to 3 times in sequence with a 30s
sleep between runs. For each run, classify the failure:

| Classification | Signal | Action |
|---|---|---|
| **Pass** | exit 0 | Stop retrying — it's flake. Skip to step 6 (no-op exit). |
| **Network / proxy** | `ECONNREFUSED`, `ETIMEDOUT`, `ENOTFOUND`, "socket hang up", proxy auth errors, all assertions of form `result.success === true` failing because `success === false` with `errorCode === "unknown"` | YouTube or proxy is down. Skip to step 6 (no-op exit). |
| **Assertion** | `AssertionError` with stable field-level message across runs (e.g. `"Channel should have at least one video"`, `"viewCount should be > 0"`) | Real breakage. Continue to step 3. |
| **Mixed** | Different errors each retry, no clear pattern | Treat as transient. Skip to step 6. |

The goal of this step is **avoid false positives**. When in doubt, treat as
transient and exit. The cost of a missed real breakage is one cycle (next
scheduled run will catch it); the cost of a wrong fix committed to main
is consumer breakage.

### Step 3 — Diagnose

For each failing assertion, identify the affected field or behavior:

- "Channel should have at least one video" / 0 videos extracted →
  `videoListItem.required` fields aren't all resolving on the new layout.
  Inspect a real channel page's `pageData` (use the technique from
  `tests/integration.test.ts` — fetch via `fetchYoutubePage`) and
  identify the new path for the missing field.
- `viewCount` / `length` / `age` is `undefined` when it shouldn't be →
  the corresponding field's `paths` in `src/paths.json` no longer matches.
- Continuation / `fetchMoreVideos` returns nothing → check
  `pagination.continuation.strategies` and the request template.
- API key not extracted → `html.apiKey.patterns` outdated.
- `pageData not found` / `clientData not found` → the relevant entry in
  `html.blocks` outdated.

If the diagnosis points to **anything other than a `paths.json` edit** —
for example, a value format that no existing transform handles, or a
brand new pagination shape requiring a new strategy *type* — give up and
skip to step 6. That class of fix needs human review and a version bump.

### Step 4 — Apply fix to `src/paths.json`

Edit only `src/paths.json`. Add the new path **before** the existing ones
in the relevant `paths` array, so the new layout is tried first while
old data still resolves through the fallback. Do not delete old paths.

Examples:
- New title path `metadata.fooMetadataViewModel.title.text` →
  prepend to `videoListItem.fields.title.paths`.
- New continuation key `nextEndpoint` →
  prepend a `{ "type": "find_key", "key": "nextEndpoint" }` to
  `pagination.continuation.strategies.default`.

### Step 5 — Verify

After each fix attempt:

1. Run `npm run test:unit`. Must pass.
2. Run `npm run test:integration` **twice** in sequence. Both must pass —
   one pass is not sufficient (live tests are mildly flaky and we don't
   want to push a fix that only works half the time).
3. If still failing, increment the fix-attempt counter. If counter < 3,
   loop back to step 3 with the new test output. If counter == 3, give
   up — skip to step 6.

### Step 6 — Commit and push (only on success)

If and only if all of the following are true:
- A fix was applied this run (no-op runs skip this step entirely).
- Final `npm test` passes (exit 0, fail count 0).
- Both verification integration runs in step 5 passed.

Then:

```bash
git add src/paths.json
git commit -m "$(cat <<'EOF'
fix(paths): <one-line summary of which field/section was patched>

<2-4 lines describing the failing assertion that triggered the fix and
which paths.json entry was updated. No code changes.>

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
git push origin main
```

If commit/push fails (e.g. fast-forward rejected because someone pushed
in parallel), do not force-push. Just exit — next scheduled run will
re-evaluate.

### Step 7 — Exit summary

Print a single-line summary to the run log:
- `OK: baseline green, no changes` (most common)
- `OK: transient (network/proxy/youtube), no changes`
- `OK: fixed <field> in paths.json, pushed <sha>`
- `GAVE UP: <reason>` (e.g. "needs new transform", "fix attempts exhausted",
  "diagnosis unclear")

## Things this runbook deliberately does NOT do

- Bump package version (no JSON-only change warrants a publish).
- Edit any `*.ts` file (would require a release; out of scope).
- Open PRs (this repo's policy is direct-to-main).
- Force push, amend published commits, or skip hooks.
- Touch `node_modules`, `dist`, lockfiles, or test fixtures.
- Modify CLAUDE.md or this file. (If procedure needs to change, that's a
  human task.)
