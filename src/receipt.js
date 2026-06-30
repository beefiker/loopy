// Host-agnostic receipt recovery for SubagentStop handlers.
//
// Codex puts the worker's final text in `last_assistant_message`; Claude Code may omit it but
// provides the subagent's own transcript. So we prefer the direct field and otherwise fall back
// to the bounded transcript tail, taking the LAST match (the most recent message). This works
// whether or not `last_assistant_message` exists and regardless of the transcript JSONL schema —
// we scan for the receipt token, not a specific record shape. On a miss the caller blocks/retries
// and the deterministic completion floor still gates the loop, exactly as the host contract states.

import { readTranscriptTail } from "./continuation.js";

// Capture the path but stop at quotes (and whitespace): when the fallback scans a transcript
// JSONL tail, the receipt is embedded in JSON (..."SUPERLOOPY_EVIDENCE: <path>"}), so a greedy
// \S+ would swallow the trailing `"}`. Evidence-root paths never contain quotes, so excluding
// them yields the clean path on both the direct (plain-text) and transcript (JSON) paths.
const EVIDENCE = /(?:EVIDENCE_RECORDED|SUPERLOOPY_EVIDENCE):\s*([^\s"']+)/u;
const EVIDENCE_G = /(?:EVIDENCE_RECORDED|SUPERLOOPY_EVIDENCE):\s*([^\s"']+)/gu;
const AUDIT = /SUPERLOOPY_AUDIT:\s*([^\s"']+)/u;
const AUDIT_G = /SUPERLOOPY_AUDIT:\s*([^\s"']+)/gu;

// Claude SubagentStop carries the subagent's own transcript separately; prefer it so the
// fallback reads THIS worker's final message, not a sibling's. Codex uses transcript_path.
function subagentTranscriptPath(payload) {
  return payload?.agent_transcript_path ?? payload?.transcript_path;
}

function firstMatch(message, regex) {
  if (typeof message !== "string") return null;
  return regex.exec(message)?.[1] ?? null;
}

function lastMatch(text, globalRegex) {
  if (typeof text !== "string" || text.length === 0) return null;
  let last = null;
  let m;
  while ((m = globalRegex.exec(text)) !== null) last = m[1];
  return last;
}

export function receiptFromPayload(payload) {
  return (
    firstMatch(payload?.last_assistant_message, EVIDENCE) ??
    lastMatch(readTranscriptTail(subagentTranscriptPath(payload)), EVIDENCE_G)
  );
}

export function auditReceiptFromPayload(payload) {
  return (
    firstMatch(payload?.last_assistant_message, AUDIT) ??
    lastMatch(readTranscriptTail(subagentTranscriptPath(payload)), AUDIT_G)
  );
}

// A host may namespace a plugin-bundled agent type (Claude sends `superloopy:franky`); Codex
// sends the bare `franky`. Strip any leading `<ns>:` so the SubagentStop matchers fire on both.
export function normalizeAgentType(agentType) {
  if (typeof agentType !== "string") return agentType;
  const idx = agentType.lastIndexOf(":");
  return idx >= 0 ? agentType.slice(idx + 1) : agentType;
}
