# Superloopy on Claude Code — Live Validation Checklist

The dual-host port was built against the Claude Code docs and is **degrade-safe by design**: if any host behavior below differs, the receipt/steering gate falls back to advisory and the deterministic CLI floor (`loop check`/`review`/`checkpoint` + audit re-derivation) still gates completion. This checklist confirms the four behaviors that could only be verified on a real Claude Code instance, plus baseline install/operation.

Run it once on a real install and fill in the results table at the end.

## 0. Install

```
/plugin marketplace add beefiker/superloopy
/plugin install superloopy@beefiker
```

- Reload plugins (or restart Claude Code); approve hooks when prompted.
- Expect: `superloopy` appears in `/plugin` (installed). Node.js ≥ 20 present.

## 1. Components load

- **Skills**: send a UI prompt (e.g. "make this landing page look less generic"). Expect the `superloopy-frontend` skill to engage (opens with `SUPERLOOPY FRONTEND ENABLED`). Try `loopy <task>` / `루피 <task>` for the loop engineer.
- **Subagents**: run `/agents`. Expect six entries (namespaced like `superloopy:franky … superloopy:nami`).
- **Doctor + bootstrap no-op**: `node "${CLAUDE_PLUGIN_ROOT}/src/cli.js" doctor --json`. Expect `ok: true`. (SessionStart bootstrap is a clean no-op on Claude — `host: "claude"`, no `~/.codex` writes.)

## 2. Capture a real SubagentStop payload (the empirical crux)

Add a **temporary** observation hook to your Claude `settings.json` (this runs alongside the plugin hook; remove it after):

```json
{ "hooks": { "SubagentStop": [ { "hooks": [ { "type": "command", "command": "cat >> /tmp/superloopy-subagentstop.jsonl" } ] } ] } }
```

Then dispatch any subagent (e.g. start a `loopy team` task that spawns `franky`, or ask Claude to use the `superloopy:nami` agent). Inspect `/tmp/superloopy-subagentstop.jsonl` and confirm:

### Linchpin A — receipt field
- [ ] Is `last_assistant_message` present? If **yes** → the receipt is read directly (Codex-style path). If **no** → confirm `transcript_path` or `agent_transcript_path` is present and its file's final assistant turn contains the `SUPERLOOPY_EVIDENCE:`/`SUPERLOOPY_AUDIT:` line (the transcript-tail fallback reads it).
- [ ] Functional check: have a worker end with `SUPERLOOPY_EVIDENCE: <path-under-evidence-root>`. Expect the SubagentStop hook to **accept silently** (no "evidence receipt missing" re-prompt). A worker that omits the receipt should be re-prompted (up to 3 attempts).

### Linchpin B — agent_type namespacing
- [ ] Is `agent_type` `franky` or `superloopy:franky`? Either is fine — the matcher `(?:superloopy:)?(?:franky|…)` and `normalizeAgentType()` handle both. Confirm the worker hook actually fired for the dispatched role (and the `robin` auditor routes to `subagent-stop-audit`).

## 3. Linchpin C — plugin env vars reach the hook subprocess

- [ ] Set in Claude `settings.json` `env`: `SUPERLOOPY_STOP_HOOK=on` and `SUPERLOOPY_AUTO_CONTEXT=on`.
- [ ] Mid-loop, confirm the **Stop** hook continues the loop (the agent does not stop while criteria remain) and that SessionStart/UserPromptSubmit inject Superloopy context. If env vars set in `settings.json` work but plugin-defined ones do not, that is expected — document `settings.json env` as the toggle location.

## 4. Linchpin D — UserPromptSubmit steering JSON

- [ ] Send a prompt containing a `SUPERLOOPY_STEER: { "kind": "annotate", "evidence": "...", "rationale": "..." }` directive. Expect Claude to apply it without a hook-output parse error. If the richer envelope (`{…, plan, summary, guide}`) is rejected, confirm the plain `additionalContext` steer still lands; otherwise the steer is advisory and the loop is unaffected.

## 5. Full loop end-to-end

- [ ] `loopy <small task>` → the engineer drives `begin` → `prove` (with a real command) → `check` → `finish`.
- [ ] Confirm completion is **gated**: `finish` refuses without a real artifact under `.superloopy/evidence/`.

## 6. Degrade-safety (must hold even if 2–4 differ)

- [ ] With any linchpin failing, `loop check`/`finish` must still refuse to complete without artifacts. The hook layer is advisory; the in-process floor is authoritative. Confirm a deliberately-unproven criterion cannot be finished.

## Results

Live capture on real Claude Code (2026-07-01): a temporary `SubagentStop` observation hook in `settings.local.json` fired **mid-session without a restart** and captured a real payload from a dispatched `superloopy:nami` subagent.

| Item | Expected | Observed | Pass | Follow-up |
| --- | --- | --- | --- | --- |
| Install + components | superloopy + 6 agents + skills load | 6 agents dispatchable as `superloopy:<name>`; skills present | ✅ | — |
| A: receipt field | last_assistant_message or transcript fallback recovers receipt | **`last_assistant_message` IS present** (string, carried the `SUPERLOOPY_EVIDENCE:` line); both `transcript_path` and `agent_transcript_path` also present. `receiptFromPayload()` recovered the exact path from the real payload. | ✅ | Docs implied it was absent — the direct field is the primary path on Claude, same as Codex; the transcript fallback is a rarely-hit safety net. |
| B: agent_type | matcher fires (bare or namespaced) | `agent_type` = `"superloopy:nami"` (namespaced); anchored matcher `^(?:superloopy:)?…$` matches it and `normalizeAgentType` → `nami`. | ✅ | — |
| C: env vars | Stop continuation + auto-context toggle | Settings-based hook fired and received the full payload (settings hooks reach the subprocess); dedicated `SUPERLOOPY_STOP_HOOK`/`SUPERLOOPY_AUTO_CONTEXT` toggles not separately exercised. | ◑ | Confirm the env-var toggles in a full loop. |
| D: steering JSON | directive applied, no parse error | not yet tested | ☐ | Send a `SUPERLOOPY_STEER:` prompt in a live loop. |
| Full loop | gated begin→prove→check→finish | not yet run with the refreshed (hardened) plugin — the live session had marketplace `0.6.1` loaded | ☐ | Refresh the plugin from the `beefiker` directory marketplace (or `--plugin-dir` the checkout) and run one loop. |
| Degrade-safety | floor blocks completion without artifacts | covered by the deterministic floor + 306 unit tests; gate refuses finish without artifacts | ✅ | — |

The two empirically-crucial linchpins (A receipt field, B agent_type) are **confirmed on real Claude Code**. C/D and a full end-to-end loop with the hardened plugin remain for a fresh session.

To reproduce: add a temporary `{ "hooks": { "SubagentStop": [ { "hooks": [ { "type": "command", "command": "cat >> /tmp/superloopy-subagentstop.jsonl" } ] } ] } }` to `settings.local.json`, dispatch any `superloopy:` subagent, inspect the file, then remove the hook.
