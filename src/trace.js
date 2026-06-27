import { readFlag } from "./args.js";
import { buildGuide, formatGuideResult } from "./guide.js";
import { summarizePlan } from "./plan-summary.js";
import { evidenceRelativeDir, ledgerRelativePath, readLedger, readPlan, scopeFromSessionId } from "./store.js";

export async function traceLoop(cwd, argv = []) {
  const scope = scopeFromSessionId(readFlag(argv, "--session-id"));
  const plan = await readPlan(cwd, scope);
  const ledger = await readLedger(cwd, scope);
  const summary = summarizePlan(plan);
  const artifacts = collectArtifacts(plan);
  const missingCriteria = collectMissingCriteria(plan, plan.evidencePath ?? evidenceRelativeDir(scope));
  const timeline = ledger.map(timelineEntry);
  return {
    ok: true,
    kind: "trace",
    summary,
    paths: {
      evidence: plan.evidencePath ?? evidenceRelativeDir(scope),
      ledger: plan.ledgerPath ?? ledgerRelativePath(scope)
    },
    evidenceSummary: evidenceSummary(artifacts, missingCriteria, timeline),
    artifacts,
    missingCriteria,
    timeline,
    guide: buildGuide(plan, { cwd, scope })
  };
}

export function formatTraceResult(result) {
  const lines = [
    "Loopy trace",
    "",
    `Evidence root: \`${result.paths.evidence}\``,
    `Progress: ${result.summary.goals.complete}/${result.summary.goals.total} goals, ${result.summary.criteria.pass}/${result.summary.criteria.total} criteria`,
    evidenceSummaryLine(result.evidenceSummary),
    "",
    "Evidence artifacts:",
    ...renderArtifacts(result.artifacts),
    "",
    "Missing proof:",
    ...renderMissingCriteria(result.missingCriteria),
    "",
    "Timeline:",
    ...renderTimeline(result.timeline)
  ];
  const guideText = result.guide === undefined ? "" : `\n${formatGuideResult(result)}`;
  return `${lines.join("\n")}\n${guideText}`;
}

function evidenceSummary(artifacts, missingCriteria, timeline) {
  return {
    artifactBackedCriteria: artifacts.length,
    missingProof: missingCriteria.length,
    timelineEvents: timeline.length
  };
}

export function evidenceSummaryLine(summary) {
  return `Evidence summary: ${summary.artifactBackedCriteria} artifact-backed criteria, ${summary.missingProof} missing proof, ${summary.timelineEvents} timeline events`;
}

function collectArtifacts(plan) {
  return plan.goals.flatMap((goal) =>
    goal.criteria
      .filter((criterion) => typeof criterion.artifact === "string" && criterion.artifact.length > 0)
      .map((criterion) => criterionTrace(goal, criterion))
  );
}

function collectMissingCriteria(plan, evidenceRoot) {
  return plan.goals.flatMap((goal) =>
    goal.criteria
      .filter((criterion) => criterion.status !== "pass" || !criterion.artifact)
      .map((criterion) => ({
        ...criterionTrace(goal, criterion),
        suggestedArtifact: `${evidenceRoot}/${goal.id}-${criterion.id}.txt`
      }))
  );
}

function criterionTrace(goal, criterion) {
  const item = {
    ref: `${goal.id}/${criterion.id}`,
    goalId: goal.id,
    criterionId: criterion.id,
    status: criterion.status,
    scenario: criterion.scenario,
    artifact: criterion.artifact ?? null,
    capturedAt: criterion.capturedAt ?? null
  };
  if (criterion.notes !== undefined) item.notes = criterion.notes;
  return item;
}

function timelineEntry(entry, index) {
  return {
    index: index + 1,
    at: typeof entry.at === "string" ? entry.at : null,
    kind: typeof entry.kind === "string" ? entry.kind : "unknown",
    ref: entry.goalId && entry.criterionId ? `${entry.goalId}/${entry.criterionId}` : entry.goalId ?? null,
    status: entry.status ?? null,
    artifact: entry.artifact ?? null,
    evidence: entry.evidence ?? null,
    notes: entry.notes ?? null
  };
}

function renderArtifacts(artifacts) {
  if (artifacts.length === 0) return ["- none"];
  return artifacts.map((item) => {
    const capturedAt = item.capturedAt === null ? "" : ` at ${item.capturedAt}`;
    const notes = item.notes === undefined ? "" : ` - notes: ${item.notes}`;
    return `- ${item.ref} ${item.status}${capturedAt} \`${item.artifact}\`${notes}`;
  });
}

function renderMissingCriteria(criteria) {
  if (criteria.length === 0) return ["- none"];
  return criteria.map((item) => `- ${item.ref} ${item.status} -> \`${item.suggestedArtifact}\` ${item.scenario}`);
}

function renderTimeline(timeline) {
  if (timeline.length === 0) return ["- none"];
  return timeline.map((item) => {
    const parts = [`${item.index}.`];
    if (item.at) parts.push(item.at);
    parts.push(item.kind);
    if (item.ref) parts.push(item.ref);
    if (item.status) parts.push(item.status);
    if (item.artifact) parts.push(`\`${item.artifact}\``);
    if (item.notes !== null && item.notes !== undefined) parts.push(`notes: ${item.notes}`);
    return `- ${parts.join(" ")}`;
  });
}
