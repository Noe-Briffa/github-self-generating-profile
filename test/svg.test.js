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

test("portrait full s'écrit ligne par ligne en 13 secondes, avec repli sans animation", () => {
  const svg = render(
    { generatedAt: "2026-09-28T04:02:00Z", stats: {}, projects: [], stack: [] },
    { githubUsername: "U", portrait: "full" },
    new Date("2026-09-28T04:02:00Z")
  );
  const delays = [...svg.matchAll(/class="portrait typing-row" style="--type-delay:([\d.]+)s"/g)].map((match) => Number(match[1]));
  const duration = Number(svg.match(/animation: type-line ([\d.]+)s steps\(\d+, end\)/)?.[1]);
  assert.equal(delays.length, 160);
  assert.equal(delays[0], 0);
  assert.ok(delays.every((delay, index) => index === 0 || delay > delays[index - 1]));
  assert.ok(Math.abs(delays.at(-1) + duration - 13) < 0.001);
  assert.match(svg, /steps\(320, end\)/);
  assert.match(svg, /@media \(prefers-reduced-motion: reduce\).*\.typing-row.*animation: none/);
});
