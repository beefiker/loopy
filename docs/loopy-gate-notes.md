# Loopy Gate Notes

Loopy keeps strict completion evidence while using Loopy-native names in code, docs, tests, and public commands.

## Gate Compatibility

- Default gate: `status: "passed"` plus non-empty artifact paths under the active evidence root.
- Review gate: `codeReview`, `manualQa`, `gateReview`, `iteration`, `criteriaCoverage`, and `audit` sections must all validate.
- Matrix gate: `architectReview`, `executorQa`, `iteration`, and `audit` sections must all validate.
- Audit section: `recommendation: "APPROVE"`, a non-empty `verdicts` array of resolvable verdict artifacts, and empty `blockers`. Mandatory for review and matrix gates; opt-in for the default gate via `LOOPY_AUDIT=on`. Structural validation only checks the section is well-formed and the verdict files resolve. **Completion-time provenance** (`audit-gate-verify.js`, wired into `review`/`checkpoint`) then re-derives **every passed criterion's** floor in-process (not just the cited ones) and requires each cited verdict to be a hash-bound pass over that fresh re-run — so a regressed command criterion can't be skipped and a section pointing at hand-written verdict files cannot authorize completion. The deterministic re-run is the source of truth, re-derived at decision time and never trusted from the worker-writable `.loopy/audit-state.json`; the `robin` LLM verdict is advisory and downgrade-only. Scope limit: the deterministic guarantee is strong for **command-backed** criteria (Loopy re-runs the command); a **manual (commandless)** criterion is re-validated for artifact existence only — its correctness rests on the auditor's judgment and human review, not the floor. Prefer command-backed proof.
- Actor fields must be non-empty but are not tied to source-branded role names.
- Artifact references must resolve inside `.loopy/evidence/` or the active scoped evidence root, must not be symlinks, and must be non-empty files.

## Native Naming

- Runtime modules use `review-gate`, `matrix-gate`, `design-audit`, and `comparison-similarity`.
- Public doctor usage is `loopy doctor --comparison-path /path/to/comparison --json`.
- Tests use Loopy-owned golden names: `test/golden-review-gate.test.js` and `test/golden-matrix-gate.test.js`.
- `LOOPY_EVIDENCE` is the primary receipt marker; `EVIDENCE_RECORDED` remains accepted for compatibility.
- `README.md` may cite the audited GitHub install-pattern reference; runtime modules, hooks, tests, and skills must keep Loopy-native names.

## Golden Scenarios

`test/golden-hooks.test.js`, `test/golden-review-gate.test.js`, and `test/golden-matrix-gate.test.js` verify:

- context-pressure Stop silence
- strict `create_goal` guard wording
- trigger-scoped context injection on `UserPromptSubmit`
- ordinary prompt silence when active Loopy state exists
- malformed steering fail-closed behavior
- unsafe steering rejection
- invalid target fail-closed behavior
- scoped session isolation
- scoped hook context injection
- scoped steering isolation from global state
- `LOOPY_EVIDENCE` and legacy receipt compatibility
- symlink evidence rejection
- three-attempt subagent receipt state
- five-section review gate acceptance
- weak manual QA quality gate rejection
- `@goal` story splitting
- empty `@goal` block rejection
- matrix gate acceptance
- inline-only executor QA proof rejection
- not-applicable adversarial case rejection
- one-time SessionStart bootstrap for the command wrapper and bundled agents
- quiet default plugin continuation hook registration

Evidence trace: Loopy's `trace` view shows artifact-backed proof, missing proof, suggested artifact paths, summary counts, and timestamped ledger events.

Evidence report: Loopy writes a portable report artifact with an Evidence Summary section, recorded evidence, artifact capture times, a timestamped timeline, next action, and proof plan.

Flow checklist guide: Loopy's guide and hooks show start or resume, record artifact-backed proof, check evidence, and finish with quality gate.

## Host Contract

Loopy rides the host's native subagents. The precise `SubagentStop` payload contract and the host behaviors Loopy cannot verify (advisory limits) are documented in `docs/loopy-host-contract.md`. Absent host support the hook gates degrade to advisory, while the deterministic completion floor still gates completion on the CLI path.
