const fs = require("fs");
const path = require("path");
const { log, readConfig, daysAgoISO, fetchJson } = require("./utils");

const FIELDS = ["name", "html_url", "description", "fork", "archived", "stargazers_count", "forks_count", "language", "languages_url", "created_at", "updated_at", "pushed_at", "topics", "default_branch"];

function pick(repo) {
  const o = {};
  for (const f of FIELDS) o[f] = repo[f] ?? null;
  return o;
}

function fixtureRepos(now) {
  const iso = (d) => new Date(now.getTime() - d * 86400000).toISOString();
  return [
    { name: "overlay-forge", html_url: "https://github.com/USERNAME/overlay-forge", description: "Overlay engine & demo fixtures", fork: false, archived: false, stargazers_count: 12, forks_count: 2, language: "TypeScript", languages_url: "", created_at: iso(200), updated_at: iso(1), pushed_at: iso(1), topics: ["ai"], default_branch: "main", commits7d: 18, commits30d: 31, lastCommit: iso(1) },
    { name: "second-brain", html_url: "https://github.com/USERNAME/second-brain", description: "Notes & automations", fork: false, archived: false, stargazers_count: 5, forks_count: 0, language: "Python", languages_url: "", created_at: iso(400), updated_at: iso(3), pushed_at: iso(3), topics: [], default_branch: "main", commits7d: 11, commits30d: 20, lastCommit: iso(3) },
    { name: "old-test-repo", html_url: "https://github.com/USERNAME/old-test-repo", description: null, fork: true, archived: false, stargazers_count: 0, forks_count: 0, language: "JavaScript", languages_url: "", created_at: iso(900), updated_at: iso(200), pushed_at: iso(200), topics: [], default_branch: "main", commits7d: 0, commits30d: 0, lastCommit: iso(200) },
  ];
}

async function listRepos(username, token) {
  const out = [];
  for (let page = 1; page <= 10; page++) {
    const url = `https://api.github.com/users/${username}/repos?per_page=100&page=${page}&type=public&sort=pushed&direction=desc`;
    const batch = await fetchJson(url, token);
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

async function countCommits(owner, repo, branch, sinceISO, token, now = new Date()) {
  let total = 0;
  let lastCommit = null;
  let seven = 0;
  const since7 = new Date(now.getTime() - 7 * 86400000);
  for (let page = 1; page <= 3; page++) {
    const url = `https://api.github.com/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(branch)}&since=${sinceISO}&per_page=100&page=${page}`;
    let batch;
    try {
      batch = await fetchJson(url, token);
    } catch (e) {
      if (String(e.message).includes("409") || String(e.message).includes("404")) return { total: 0, seven: 0, lastCommit: null };
      throw e;
    }
    if (!Array.isArray(batch) || batch.length === 0) break;
    for (const c of batch) {
      const d = c?.commit?.committer?.date || c?.commit?.author?.date;
      if (!d) continue;
      total++;
      if (new Date(d) >= since7) seven++;
      if (!lastCommit || d > lastCommit) lastCommit = d;
    }
    if (batch.length < 100) break;
  }
  return { total, seven, lastCommit };
}

async function main() {
  const config = readConfig();
  const token = process.env.GITHUB_TOKEN || "";
  const outPath = path.join(__dirname, "..", "data", "raw-profile-data.json");
  const now = new Date();

  if (config.githubUsername === "USERNAME") {
    if (process.env.CI) {
      console.error("[collect] fatal: githubUsername non configure en CI - refuse fixture");
      process.exit(1);
    }
    const repos = fixtureRepos(now);
    fs.writeFileSync(outPath, JSON.stringify({ collectedAt: now.toISOString(), username: config.githubUsername, mode: "fixture", repos }, null, 2));
    log("collect", `${repos.length} repositories found (fixture, no token/username)`);
    const cutoff90 = new Date(now.getTime() - 90 * 86400000);
    log("collect", `${repos.filter((r) => !r.fork && !r.archived && r.lastCommit && new Date(r.lastCommit) >= cutoff90).length} active repositories`);
    return;
  }

  if (!token) log("collect", "no GITHUB_TOKEN, live non-authentifie (rate-limit 60/h)");

  const all = await listRepos(config.githubUsername, token);
  log("collect", `${all.length} repositories found`);
  const since30 = daysAgoISO(config.activityWindowDays || 30, now);
  const cutoff90 = new Date(now.getTime() - 90 * 86400000);
  const repos = [];
  for (const r of all) {
    try {
      const base = pick(r);
      const excluded = (config.excludeRepositories || []).includes(base.name);
      if (excluded) continue;
      if (config.excludeForks && base.fork) continue;
      if (config.excludeArchived && base.archived) continue;
      base.commits7d = 0;
      base.commits30d = 0;
      base.lastCommit = null;
      if (base.pushed_at && new Date(base.pushed_at) >= cutoff90) {
        const stats = await countCommits(config.githubUsername, base.name, base.default_branch || "main", since30, token, now);
        base.commits30d = stats.total;
        base.commits7d = stats.seven;
        base.lastCommit = stats.lastCommit || base.pushed_at;
      }
      repos.push(base);
    } catch (e) {
      log("collect", `skip ${r?.name}: ${e.message}`);
    }
  }
  const active = repos.filter((r) => r.lastCommit && new Date(r.lastCommit) >= cutoff90).length;
  fs.writeFileSync(outPath, JSON.stringify({ collectedAt: now.toISOString(), username: config.githubUsername, mode: "live", totalPublicRepositories: all.length, repos }, null, 2));
  log("collect", `${active} active repositories`);
}

main().catch((e) => {
  console.error(`[collect] fatal: ${e.message}`);
  process.exit(1);
});
