const test = require("node:test");
const assert = require("node:assert/strict");
const { recencyBonus, activityScore, repoStatus, analyze } = require("../scripts/analyze-projects");

const now = new Date("2026-09-28T04:02:00Z");
const iso = (d) => new Date(now.getTime() - d * 86400000).toISOString();

test("recency bonus thresholds", () => {
  assert.equal(recencyBonus(iso(1), now), 30);
  assert.equal(recencyBonus(iso(5), now), 20);
  assert.equal(recencyBonus(iso(10), now), 10);
  assert.equal(recencyBonus(iso(20), now), 5);
  assert.equal(recencyBonus(iso(60), now), 0);
  assert.equal(recencyBonus(null, now), 0);
});

test("activity score weights recent work over stars", () => {
  const active = { commits7d: 10, commits30d: 10, stargazers_count: 0, lastCommit: iso(1) };
  const popular = { commits7d: 0, commits30d: 0, stargazers_count: 100, lastCommit: iso(200) };
  assert.ok(activityScore(active, now) > activityScore(popular, now));
  assert.equal(activityScore(popular, now), 20); // stars capes a 20
});

test("status thresholds configurable", () => {
  const cfg = { activeDays: 14, maintainedDays: 90 };
  assert.equal(repoStatus({ lastCommit: iso(2) }, cfg, now), "ACTIVE");
  assert.equal(repoStatus({ lastCommit: iso(30) }, cfg, now), "MAINTAINED");
  assert.equal(repoStatus({ lastCommit: iso(200) }, cfg, now), "DORMANT");
  assert.equal(repoStatus({ lastCommit: iso(1), archived: true }, cfg, now), "ARCHIVED");
});

test("ranking trie par date MAJ puis score, exclut forks/archives/profil", () => {
  const cfg = { githubUsername: "U", maxProjects: 4, excludeForks: true, excludeArchived: true, excludeRepositories: ["skip"], minimumActivityScore: 1, activeDays: 14, maintainedDays: 90 };
  const raw = { repos: [
    { name: "U", commits7d: 99, commits30d: 99, stargazers_count: 0, lastCommit: iso(1) },
    { name: "fork", fork: true, commits7d: 50, commits30d: 50, stargazers_count: 0, lastCommit: iso(1) },
    { name: "arch", archived: true, commits7d: 50, commits30d: 50, stargazers_count: 0, lastCommit: iso(1) },
    { name: "skip", commits7d: 50, commits30d: 50, stargazers_count: 0, lastCommit: iso(1) },
    { name: "a", html_url: "u", description: "d", commits7d: 5, commits30d: 5, stargazers_count: 1, lastCommit: iso(5), language: "Python" },
    { name: "b", html_url: "u", description: "d", commits7d: 1, commits30d: 1, stargazers_count: 0, lastCommit: iso(1), language: "Go" },
    { name: "c", html_url: "u", description: "d", commits7d: 1, commits30d: 9, stargazers_count: 0, lastCommit: iso(5), language: "Go" },
  ]};
  const out = analyze(raw, cfg, now);
  assert.deepEqual(out.map((p) => p.name), ["b", "a", "c"]); // date d'abord, egalite tranchee par score
});
