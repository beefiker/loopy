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

| Item | Expected | Observed | Pass | Follow-up |
| --- | --- | --- | --- | --- |
| Install + components | superloopy + 6 agents + skills load | | | |
| A: receipt field | last_assistant_message or transcript fallback recovers receipt | | | |
| B: agent_type | matcher fires (bare or namespaced) | | | |
| C: env vars | Stop continuation + auto-context toggle | | | |
| D: steering JSON | directive applied, no parse error | | | |
| Full loop | gated begin→prove→check→finish | | | |
| Degrade-safety | floor blocks completion without artifacts | | | |

Remove the temporary observation hook from `settings.json` when done.
