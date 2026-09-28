const fs = require("fs");
const path = require("path");
const { log, readConfig, daysBetween } = require("./utils");

function recencyBonus(lastCommit, now = new Date()) {
  if (!lastCommit) return 0;
  const d = daysBetween(lastCommit, now);
  if (d < 3) return 30;
  if (d < 7) return 20;
  if (d < 14) return 10;
  if (d < 30) return 5;
  return 0;
}

function activityScore(r, now = new Date()) {
  const c7 = r.commits7d || 0;
  const c30 = r.commits30d || 0;
  const stars = Math.min(r.stargazers_count || 0, 20);
  return c7 * 10 + c30 * 3 + recencyBonus(r.lastCommit, now) + stars;
}

function repoStatus(r, config, now = new Date()) {
  if (r.archived) return "ARCHIVED";
  if (!r.lastCommit) return "DORMANT";
  const d = daysBetween(r.lastCommit, now);
  const activeDays = config.activeDays ?? 14;
  const maintainedDays = config.maintainedDays ?? 90;
  if (d < activeDays) return "ACTIVE";
  if (d < maintainedDays) return "MAINTAINED";
  return "DORMANT";
}

function analyze(raw, config, now = new Date()) {
  const excluded = new Set(config.excludeRepositories || []);
  const scored = [];
  for (const r of raw.repos || []) {
    if (excluded.has(r.name)) continue;
    if (config.excludeForks && r.fork) continue;
    if (config.excludeArchived && r.archived) continue;
    if (r.name === config.githubUsername) continue;
    const score = activityScore(r, now);
    if (score < (config.minimumActivityScore ?? 1)) continue;
    scored.push({
      name: r.name,
      url: r.html_url || "",
      description: r.description || "",
      status: repoStatus(r, config, now),
      commits7d: r.commits7d || 0,
      commits30d: r.commits30d || 0,
      lastCommit: r.lastCommit ? String(r.lastCommit).slice(0, 10) : "",
      primaryLanguage: r.language || "",
      activityScore: score,
      stars: r.stargazers_count || 0,
    });
  }
  // Tri demande user : lastCommit DESC, tiebreak activityScore DESC (diverge spec §10 tri score seul).
  scored.sort((a, b) => (b.lastCommit || "").localeCompare(a.lastCommit || "") || b.activityScore - a.activityScore);
  return scored.slice(0, config.maxProjects ?? 4);
}

async function main() {
  const config = readConfig();
  const rawPath = path.join(__dirname, "..", "data", "raw-profile-data.json");
  const outPath = path.join(__dirname, "..", "data", "projects.json");
  const raw = JSON.parse(fs.readFileSync(rawPath, "utf8"));
  const projects = analyze(raw, config, new Date());
  fs.writeFileSync(outPath, JSON.stringify({ analyzedAt: new Date().toISOString(), projects }, null, 2));
  log("projects", `selected ${projects.length} projects`);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(`[projects] fatal: ${e.message}`);
    process.exit(1);
  });
}

module.exports = { recencyBonus, activityScore, repoStatus, analyze };
