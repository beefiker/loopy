import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public docs describe hook proof-plan context and active evidence receipts", async () => {
  const readme = await readFile("README.md", "utf8");
  const skill = await readFile("skills/loopy-loop/SKILL.md", "utf8");

  assert.match(skill, /next command, proof target, recorded evidence.*proof plan, capture template, and evidence template/s);
  assert.match(skill, /LOOPY_EVIDENCE: <path-under-active-evidence-root>/);
});

test("public docs describe guide, trace, report, and check evidence surfaces", async () => {
  const readme = await readFile("README.md", "utf8");
  const skill = await readFile("skills/loopy-loop/SKILL.md", "utf8");
  const notes = await readFile("docs/loopy-gate-notes.md", "utf8");
  const audit = await readFile("docs/loopy-file-audit.md", "utf8");

  assert.match(skill, /manual evidence notes/i);
  assert.match(skill, /flow checklist/i);
  assert.match(notes, /Evidence trace:.*summary counts/is);
  assert.match(notes, /Flow checklist guide:/);
  assert.match(audit, /src\/trace\.js.*summary counts/is);
  assert.match(audit, /src\/report\.js.*Evidence Summary section/is);
});

test("public docs describe Loopy-native doctor checks", async () => {
  const readme = await readFile("README.md", "utf8");
  const audit = await readFile("docs/loopy-file-audit.md", "utf8");
  const skill = await readFile("skills/loopy-loop/SKILL.md", "utf8");
  const designAudit = await readFile("docs/loopy-design-audit.md", "utf8");
  const modelPolicy = await readFile("docs/loopy-model-policy.md", "utf8");

  assert.match(audit, /Loopy-native boundary/i);
  assert.match(audit, /Compatibility boundary/i);
  assert.match(skill, /generic comparison scan/i);
  assert.match(skill, /model policy/i);
  assert.match(designAudit, /## Design Decisions/);
  assert.match(designAudit, /## Compatibility Boundary/);
  assert.match(modelPolicy, /steering, not proof/i);
  assert.match(modelPolicy, /gpt-5\.4-mini/);
});

test("public docs describe real marketplace install and bootstrap", async () => {
  const readme = await readFile("README.md", "utf8");
  const skill = await readFile("skills/loopy-loop/SKILL.md", "utf8");
  const notes = await readFile("docs/loopy-gate-notes.md", "utf8");
  const installReferenceRepo = ["lazy", "codex"].join("");

  assert.match(readme, /codex plugin marketplace add https:\/\/github\.com\/beefiker\/loopy/);
  assert.match(readme, /codex plugin add loopy@beefiker/);
  assert.match(readme, new RegExp(`https://github\\.com/code-yeongyu/${installReferenceRepo}`));
  assert.match(readme, /SessionStart.*one-time bootstrap/s);
  assert.match(readme, /node src\/cli\.js install --json/);
  assert.doesNotMatch(readme, /\/Users\/bee|<repo-url>/);
  assert.match(skill, /first approved `SessionStart` hook/);
  assert.match(notes, /one-time SessionStart bootstrap/);
});

test("public docs describe loose prompt triggers as guidance-only", async () => {
  const readme = await readFile("README.md", "utf8");
  const skill = await readFile("skills/loopy-loop/SKILL.md", "utf8");
  const agent = await readFile("skills/loopy-loop/agents/openai.yaml", "utf8");

  assert.match(skill, /loopywork/);
  assert.match(skill, /never mutate/i);
  assert.match(agent, /loopywork/);
  assert.match(agent, /lpy/);
});

test("project custom agents define Loopy subagent workflow", async () => {
  const readme = await readFile("README.md", "utf8");
  const skill = await readFile("skills/loopy-loop/SKILL.md", "utf8");
  const agents = ["franky", "zoro", "usopp", "jinbe", "robin", "nami"];

  assert.match(readme, /\.codex\/agents/);
  assert.match(readme, /loopy agents install/);
  assert.match(skill, /## Optional Subagent-Driven Mode/);
  assert.match(skill, /loopy agents install/);
  assert.match(skill, /allowed files, active evidence root, report artifact target/i);

  for (const agent of agents) {
    const content = await readFile(`.codex/agents/${agent}.toml`, "utf8");
    assert.match(content, new RegExp(`name = "${agent}"`));
    assert.match(content, /model = "gpt-5/);
    assert.match(content, /model_reasoning_effort = "(low|high|xhigh)"/);
    assert.match(content, /service_tier = "(priority|fast)"/);
    assert.match(content, /developer_instructions = """/);
    if (agent !== "nami") assert.match(content, /active evidence root/);
  }
});

test("public docs describe crew lines as presentation-only status", async () => {
  const readme = await readFile("README.md", "utf8");
  const skill = await readFile("skills/loopy-loop/SKILL.md", "utf8");
  const crewLines = await readFile("docs/loopy-crew-lines.md", "utf8");
  const designAudit = await readFile("docs/loopy-design-audit.md", "utf8");

  assert.match(readme, /one original crew line/);
  assert.match(readme, /supported catalog/);
  assert.match(skill, /presentation only/);
  assert.match(skill, /LOOPY_CREW_LANGUAGE/);
  assert.match(crewLines, /Do not copy source-character quotes/);
  assert.match(crewLines, /`en`, `ko`, `ja`, `zh`, `es`, `fr`, `de`, `it`, `pt`, `id`, `hi`, `tr`, `vi`, `ru`, `ar`, and `th`/);
  assert.match(crewLines, /fall back to English/);
  assert.match(crewLines, /Evidence artifacts.*remain the authority/s);
  assert.match(designAudit, /`crew-lines`/);
});

test("loop golden set lists every Git-visible file with strict evidence", async () => {
  const golden = await readFile("docs/loopy-loop-golden-set.md", "utf8");
  const missing = listRepoFiles().filter((file) => !golden.includes(`\`${file}\``));

  assert.deepEqual(missing, []);
  assert.match(golden, /## File Evidence Inventory/);
  assert.match(golden, /Strict pass rule/);
  assert.match(golden, /Each new score must be greater than the previous score/);
  assert.doesNotMatch(golden, /\bTBD\b|\bTODO\b|pending validation/i);
});

test("loop golden set records threshold history for this turn", async () => {
  const golden = await readFile("docs/loopy-loop-golden-set.md", "utf8");

  assert.match(golden, /## Threshold Model/);
  assert.match(golden, /20/);
  assert.match(golden, /100/);
  assert.match(golden, /Turn 2\s*\|\s*96/);
  assert.match(golden, /Turn 3\s*\|\s*100/);
  assert.match(golden, /Recorded judgment trail/);
  assert.match(golden, /npm test/);
  assert.match(golden, /node src\/cli\.js doctor --json/);
});

function listRepoFiles() {
  const result = spawnSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((file) => existsSync(file))
    .sort();
}
