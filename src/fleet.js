// Parent-side coordination for subagent-driven mode. Loopy does not spawn or schedule workers,
// but the parent (Luffy) can record one handoff per dispatched worker and later reconcile the
// fleet: which assignments are outstanding, and a SINGLE normalized verdict across the workers'
// three different vocabularies (reviewer APPROVE/CHANGES_REQUESTED, QA PASS/FAIL, gate
// APPROVE/REJECT). This is additive and parent-side — it never spawns and never completes.

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { readFlag } from "./args.js";
import { ensureLoopyDirs, loopyRelativeDir, nowIso, scopeFromSessionId, withFileLock, writeJsonAtomic } from "./store.js";

// Map each worker vocabulary onto one accept/reject/needs-context/pending enum so the parent
// integrates worker output mechanically instead of by hand. Lifecycle verdicts are deliberate:
// a still-running child (working/in_progress) stays outstanding (pending), and an unresolved
// child (inconclusive/timeout/ack_only) normalizes to needs-context — NEVER accept. A silent or
// ack-only lane is not an approval; the parent must close it and respawn the missing deliverable.
const VERDICT_MAP = new Map([
  ["approve", "accept"], ["pass", "accept"], ["passed", "accept"], ["done", "accept"],
  ["changes_requested", "reject"], ["fail", "reject"], ["failed", "reject"], ["reject", "reject"], ["rejected", "reject"],
  ["needs_context", "needs-context"], ["blocked", "needs-context"],
  ["inconclusive", "needs-context"], ["timeout", "needs-context"], ["ack_only", "needs-context"],
  ["working", "pending"], ["in_progress", "pending"], ["running", "pending"]
]);

export function normalizeVerdict(value) {
  if (typeof value !== "string") return "pending";
  const key = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return VERDICT_MAP.get(key) ?? "pending";
}

function handoffsPath(cwd, scope) {
  return join(cwd, loopyRelativeDir(scope), "handoffs.json");
}

async function readHandoffs(cwd, scope) {
  try {
    const parsed = JSON.parse(await readFile(handoffsPath(cwd, scope), "utf8"));
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.handoffs)) return parsed;
  } catch {
    // absent or unreadable -> empty registry
  }
  return { version: 1, sessionId: scope?.sessionId ?? null, handoffs: [] };
}

export async function handoffLoop(cwd, argv) {
  const scope = scopeFromSessionId(readFlag(argv, "--session-id"));
  const id = readFlag(argv, "--id");
  // Distinguish "flag absent" (undefined) from a supplied value so an --id update MERGES only
  // the supplied fields instead of wiping the rest to null.
  const agent = readFlag(argv, "--agent")?.trim();
  const assignment = readFlag(argv, "--assignment")?.trim();
  const status = readFlag(argv, "--status");
  const verdict = readFlag(argv, "--verdict");
  const artifact = readFlag(argv, "--artifact");
  const handoff = await withFileLock(handoffsPath(cwd, scope), async () => {
    await ensureLoopyDirs(cwd, scope);
    const state = await readHandoffs(cwd, scope);
    const now = nowIso();
    let entry = id ? state.handoffs.find((item) => item.id === id) : undefined;
    if (id && entry === undefined) throw new Error(`No handoff with id ${id}.`);
    if (entry === undefined) {
      if (!agent) throw new Error("Missing --agent.");
      if (!assignment) throw new Error("Missing --assignment.");
      entry = {
        id: `H${String(state.handoffs.length + 1).padStart(3, "0")}`,
        agent,
        assignment,
        status: status ?? "dispatched",
        verdict: verdict ?? null,
        normalizedVerdict: normalizeVerdict(verdict ?? null),
        artifact: artifact ?? null,
        recordedAt: now,
        updatedAt: now
      };
      state.handoffs.push(entry);
    } else {
      // agent/assignment are identity: overwrite only with a non-empty value, never wipe to ""
      // (the create path also rejects empty), while status/verdict/artifact stay clearable.
      if (agent) entry.agent = agent;
      if (assignment) entry.assignment = assignment;
      if (status !== undefined) entry.status = status;
      if (verdict !== undefined) {
        entry.verdict = verdict;
        entry.normalizedVerdict = normalizeVerdict(verdict);
      }
      if (artifact !== undefined) entry.artifact = artifact;
      entry.updatedAt = now;
    }
    await writeJsonAtomic(handoffsPath(cwd, scope), state);
    return entry;
  });
  return { ok: true, kind: "handoff_recorded", handoff };
}

export async function fleetLoop(cwd, argv) {
  const scope = scopeFromSessionId(readFlag(argv, "--session-id"));
  const state = await readHandoffs(cwd, scope);
  const byVerdict = { accept: 0, reject: 0, "needs-context": 0, pending: 0 };
  for (const handoff of state.handoffs) {
    // Guard against an out-of-enum verdict (only possible via a hand-edited file): count it as
    // pending rather than producing a NaN bucket.
    const key = Object.prototype.hasOwnProperty.call(byVerdict, handoff.normalizedVerdict) ? handoff.normalizedVerdict : "pending";
    byVerdict[key] += 1;
  }
  const outstanding = state.handoffs
    .filter((handoff) => (handoff.normalizedVerdict ?? "pending") === "pending")
    .map((handoff) => ({ id: handoff.id, agent: handoff.agent, assignment: handoff.assignment }));
  const result = { ok: true, kind: "fleet", summary: { dispatched: state.handoffs.length, byVerdict }, outstanding, handoffs: state.handoffs };
  const cap = Number.parseInt(process.env.LOOPY_MAX_PARALLEL ?? "", 10);
  if (Number.isInteger(cap) && cap > 0 && outstanding.length > cap) {
    result.warning = `${outstanding.length} outstanding handoffs exceed LOOPY_MAX_PARALLEL=${cap}; collect some before dispatching more.`;
  }
  return result;
}
