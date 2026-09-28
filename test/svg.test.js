const test = require("node:test");
const assert = require("node:assert/strict");
const { escapeXml } = require("../scripts/utils");
const { render } = require("../scripts/generate-profile");

function sectionY(svg, label) {
  const match = [...svg.matchAll(/<text x="40" y="(\d+)" class="title(?: [^"]*)?">([^<]*)<\/text>/g)]
    .find(([, , text]) => text === label);
  return match ? Number(match[1]) : -1;
}

test("escape XML casse pas le SVG", () => {
  assert.equal(escapeXml('a&b<c>d"e'), "a&amp;b&lt;c&gt;d&quot;e");
});

test("render robuste vide + hostile", () => {
  const svg = render(
    {
      generatedAt: "2026-09-28T04:02:00Z",
      stats: { publicRepositories: 0, activeRepositories: 0, commits7d: 0, commits30d: 0 },
      projects: [
        { name: 'x&<>"very-long-name-qui-depasse-largement-les-trente-caracteres', description: 'd&<>"', commits7d: 0, commits30d: 0, lastCommit: "", primaryLanguage: "", status: "DORMANT" },
        { name: "image-colorization-nn", description: "Computer vision", status: "ACTIVE" },
      ],
      stack: [],
    },
    { githubUsername: "U", portrait: "full" },
    new Date("2026-09-28T04:02:00Z")
  );
  for (const bad of ["undefined", "NaN", "null>"]) assert.ok(!svg.includes(bad), `trouve: ${bad}`);
  assert.ok(svg.includes("&amp;&lt;&gt;&quot;"));
  assert.ok(svg.includes("assets") === false); // autonome, pas de ref externe
  const sections = ["PORTRAIT", "CURRENTLY LEARNING — MASTER SSI @ UTT", "CYBERSECURITY FOCUS AREAS", "CURRENTLY BUILDING", "TECHNICAL TOOLBOX", "ACTIVITY"];
  const positions = sections.map((section) => sectionY(svg, section));
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
  assert.ok(positions[1] > positions[0] + 80);
  assert.ok(positions[2] > positions[1] + 50);
  assert.ok(positions[3] > positions[2] + 58);
  assert.ok(positions[4] > positions[3] + 40);
  assert.ok(svg.includes("Infrastructure &amp; cloud"));
  assert.ok(svg.includes("Cyber investigation &amp; OSINT"));
  assert.ok(svg.includes("--cyber: #38bdf8"));
  assert.ok(svg.includes("--ai: #a78bfa"));
  assert.ok(svg.includes('<tspan class="cyber-accent">CYBERSECURITY</tspan>'));
  assert.ok(svg.includes('<tspan class="ai-accent">AI SYSTEMS</tspan>'));
  assert.ok(svg.includes('<tspan class="cyber-accent">&gt;</tspan>'));
  assert.ok(svg.includes('<tspan class="ai-accent">AI / DATA</tspan>'));
  assert.match(svg, /<circle cx="78" cy="\d+" r="3" class="dot-muted"\/>/);
  assert.match(svg, /<circle cx="78" cy="\d+" r="3" class="dot-active"\/>/);
  assert.ok(!svg.includes("HANDS-ON"));
  assert.ok(!svg.includes("class=\"stack pct\""));
});

test("portrait full s'écrit ligne par ligne en 5 secondes, avec repli sans animation", () => {
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
  assert.ok(Math.abs(delays.at(-1) + duration - 5) < 0.001);
  assert.match(svg, /steps\(320, end\)/);
  assert.match(svg, /@media \(prefers-reduced-motion: reduce\).*\.typing-row.*animation: none/);
  assert.ok(sectionY(svg, "ACTIVITY") > sectionY(svg, "PORTRAIT"));
  assert.ok(!svg.includes("AI / DATA"));
});
