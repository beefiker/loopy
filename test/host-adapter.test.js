import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { auditReceiptFromPayload, normalizeAgentType, receiptFromPayload } from "../src/receipt.js";
import { bootstrapSuperloopy, isClaudeHost } from "../src/agents.js";

async function transcript(lines) {
  const dir = await mkdtemp(join(tmpdir(), "superloopy-receipt-"));
  const path = join(dir, "transcript.jsonl");
  await writeFile(path, lines.join("\n"), "utf8");
  return path;
}

test("receiptFromPayload reads last_assistant_message directly (Codex path)", () => {
  const r = receiptFromPayload({ last_assistant_message: "done\nSUPERLOOPY_EVIDENCE: .superloopy/evidence/a.md" });
  assert.equal(r, ".superloopy/evidence/a.md");
});

test("receiptFromPayload falls back to the subagent transcript tail and takes the LAST match (Claude path)", async () => {
  const path = await transcript([
    JSON.stringify({ role: "assistant", content: "SUPERLOOPY_EVIDENCE: .superloopy/evidence/old.md" }),
    JSON.stringify({ role: "user", content: "retry" }),
    JSON.stringify({ role: "assistant", content: "done\nSUPERLOOPY_EVIDENCE: .superloopy/evidence/final.md" })
  ]);
  const r = receiptFromPayload({ agent_transcript_path: path }); // no last_assistant_message
  assert.equal(r, ".superloopy/evidence/final.md");
});

test("receiptFromPayload accepts the EVIDENCE_RECORDED compatibility alias", () => {
  const r = receiptFromPayload({ last_assistant_message: "EVIDENCE_RECORDED: .superloopy/evidence/b.md" });
  assert.equal(r, ".superloopy/evidence/b.md");
});

test("receiptFromPayload uses transcript_path when agent_transcript_path is absent", async () => {
  const path = await transcript([JSON.stringify({ role: "assistant", content: "SUPERLOOPY_EVIDENCE: .superloopy/evidence/c.md" })]);
  assert.equal(receiptFromPayload({ transcript_path: path }), ".superloopy/evidence/c.md");
});

test("receiptFromPayload returns null when no receipt is anywhere (gate stays unsatisfied)", async () => {
  const path = await transcript([JSON.stringify({ role: "assistant", content: "no receipt here" })]);
  assert.equal(receiptFromPayload({ agent_transcript_path: path }), null);
  assert.equal(receiptFromPayload({}), null);
});

test("auditReceiptFromPayload mirrors the same direct/transcript fallback for SUPERLOOPY_AUDIT", async () => {
  assert.equal(
    auditReceiptFromPayload({ last_assistant_message: "SUPERLOOPY_AUDIT: .superloopy/evidence/audit/v.json" }),
    ".superloopy/evidence/audit/v.json"
  );
  const path = await transcript([
    JSON.stringify({ role: "assistant", content: "SUPERLOOPY_AUDIT: .superloopy/evidence/audit/old.json" }),
    JSON.stringify({ role: "assistant", content: "SUPERLOOPY_AUDIT: .superloopy/evidence/audit/new.json" })
  ]);
  assert.equal(auditReceiptFromPayload({ agent_transcript_path: path }), ".superloopy/evidence/audit/new.json");
});

test("normalizeAgentType strips a host namespace so SubagentStop matchers fire on both hosts", () => {
  assert.equal(normalizeAgentType("franky"), "franky"); // Codex bare
  assert.equal(normalizeAgentType("superloopy:franky"), "franky"); // Claude plugin-namespaced
  assert.equal(normalizeAgentType("robin"), "robin");
  assert.equal(normalizeAgentType(undefined), undefined);
});

test("bootstrapSuperloopy is a clean no-op on Claude Code (no ~/.codex install)", async () => {
  const home = await mkdtemp(join(tmpdir(), "superloopy-claude-home-"));
  assert.equal(isClaudeHost({ CLAUDE_PLUGIN_ROOT: "/plugins/superloopy" }), true);
  assert.equal(isClaudeHost({}), false);
  const result = await bootstrapSuperloopy(process.cwd(), [], { env: { CLAUDE_PLUGIN_ROOT: "/plugins/superloopy" }, homeDir: home });
  assert.equal(result.host, "claude");
  assert.equal(result.ok, true);
  assert.deepEqual(result.agents.agents, []);
});
