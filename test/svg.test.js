const test = require("node:test");
const assert = require("node:assert/strict");
const { escapeXml } = require("../scripts/utils");
const { render } = require("../scripts/generate-profile");

test("escape XML casse pas le SVG", () => {
  assert.equal(escapeXml('a&b<c>d"e'), "a&amp;b&lt;c&gt;d&quot;e");
});

test("render robuste vide + hostile", () => {
  const svg = render(
    {
      generatedAt: "2026-09-28T04:02:00Z",
      stats: { publicRepositories: 0, activeRepositories: 0, commits7d: 0, commits30d: 0 },
      projects: [{ name: 'x&<>"very-long-name-qui-depasse-largement-les-trente-caracteres', description: 'd&<>"', commits7d: 0, commits30d: 0, lastCommit: "", primaryLanguage: "", status: "DORMANT" }],
      stack: [],
    },
    { githubUsername: "U" },
    new Date("2026-09-28T04:02:00Z")
  );
  for (const bad of ["undefined", "NaN", "null>"]) assert.ok(!svg.includes(bad), `trouve: ${bad}`);
  assert.ok(svg.includes("&amp;&lt;&gt;&quot;"));
  assert.ok(svg.includes("assets") === false); // autonome, pas de ref externe
});
