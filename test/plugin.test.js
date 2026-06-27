import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("plugin manifest exposes Loopy skills and packaged opt-in hooks", async () => {
  const plugin = JSON.parse(await readFile(".codex-plugin/plugin.json", "utf8"));

  assert.equal(plugin.skills, "./skills/");
  assert(plugin.hooks.includes("./hooks/session-start.json"));
  assert(plugin.hooks.includes("./hooks/user-prompt-submit.json"));
  assert(plugin.hooks.includes("./hooks/pre-tool-use.json"));
  assert(plugin.interface.defaultPrompt.some((line) => /bootstraps the CLI wrapper/.test(line)));
  assert.equal(plugin.hooks.includes("./hooks/stop.json"), true);
});

test("subagent receipt hook covers Loopy evidence-reporting agents", async () => {
  const hook = JSON.parse(await readFile("hooks/subagent-stop.json", "utf8"));
  const matcher = new RegExp(hook.hooks.SubagentStop[0].matcher);

  assert.equal(matcher.test("franky"), true);
  assert.equal(matcher.test("zoro"), true);
  assert.equal(matcher.test("usopp"), true);
  assert.equal(matcher.test("jinbe"), true);
  assert.equal(matcher.test("robin"), false);
});

test("repo marketplace exposes Loopy plugin install entry", async () => {
  const marketplace = JSON.parse(await readFile(".agents/plugins/marketplace.json", "utf8"));
  const entry = marketplace.plugins.find((plugin) => plugin.name === "loopy");

  assert.equal(marketplace.name, "beefiker");
  assert.equal(marketplace.interface.displayName, "Loopy");
  assert.deepEqual(entry.source, { source: "local", path: "./" });
  assert.equal(entry.policy.installation, "AVAILABLE");
  assert.equal(entry.policy.authentication, "ON_INSTALL");
  assert.equal(entry.category, "Developer Tools");
});

test("Stop hook manifest routes to the Loopy CLI", async () => {
  const hook = JSON.parse(await readFile("hooks/stop.json", "utf8"));
  const command = hook.hooks.Stop[0].hooks[0].command;

  assert.equal(command, 'node "${PLUGIN_ROOT}/src/cli.js" hook stop');
  assert.match(hook.hooks.Stop[0].hooks[0].statusMessage, /Continu/);
});
