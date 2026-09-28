const fs = require("fs");
const path = require("path");
const { log, readConfig, daysBetween, fetchJson } = require("./utils");

// Mapping deterministe isole : fichier -> techno, avec test de contenu optionnel.
const STACK_RULES = [
  { tech: "Docker", files: ["Dockerfile"] },
  { tech: "Docker Compose", files: ["docker-compose.yml", "compose.yml"] },
  { tech: "Kubernetes", files: ["k8s/", "kubernetes/", "helm/"], dirs: true },
  { tech: "Terraform", files: ["terraform/"], dirs: true },
  { tech: "React", files: ["package.json"], contains: ["react"] },
  { tech: "Next.js", files: ["package.json"], contains: ["next"] },
  { tech: "TypeScript", files: ["package.json"], contains: ["typescript"] },
  { tech: "FastAPI", files: ["requirements.txt", "pyproject.toml", "Pipfile"], contains: ["fastapi"] },
  { tech: "PyTorch", files: ["requirements.txt", "pyproject.toml"], contains: ["torch"] },
  { tech: "Flutter", files: ["pubspec.yaml"] },
];

const LANGUAGE_MAP = {
  Python: "Python",
  TypeScript: "TypeScript",
  JavaScript: "JavaScript",
  Dart: "Dart",
  Go: "Go",
  Rust: "Rust",
  Java: "Java",
  "C#": "C#",
  "C++": "C++",
  Shell: "Shell",
  HTML: "HTML",
};

async function fetchText(owner, repo, filePath, token) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
  try {
    const j = await fetchJson(url, token);
    if (j && j.content && j.encoding === "base64") {
      return Buffer.from(j.content, "base64").toString("utf8").slice(0, 20000).toLowerCase();
    }
  } catch (_) {
    return null;
  }
  return null;
}

function repoWeight(commits30d) {
  return 1 + Math.log(1 + (commits30d || 0));
}

function detectFromLanguage(repos) {
  // Retourne Map tech -> [{repo, weight}] base sur langage principal (whitelist, inconnus ignores).
  const hits = new Map();
  for (const r of repos) {
    const lang = r.language || r.primaryLanguage;
    const tech = LANGUAGE_MAP[lang];
    if (!tech) continue;
    const w = repoWeight(r.commits30d);
    if (!hits.has(tech)) hits.set(tech, 0);
    hits.set(tech, hits.get(tech) + w);
  }
  return hits;
}

async function detectFromFiles(repos, owner, token, fetchFn = fetchText) {
  const hits = new Map();
  for (const r of repos) {
    const w = repoWeight(r.commits30d);
    for (const rule of STACK_RULES) {
      for (const f of rule.files) {
        if (rule.dirs) {
          try {
            const listing = await fetchJson(`https://api.github.com/repos/${owner}/${r.name}/contents/${f}`, token);
            if (Array.isArray(listing) && listing.length > 0) {
              hits.set(rule.tech, (hits.get(rule.tech) || 0) + w);
              break; // 1 hit max par regle et par repo
            }
          } catch (_) { /* absent, ignore */ }
          continue;
        }
        const text = await fetchFn(owner, r.name, f, token);
        if (text === null) continue;
        if (rule.contains && !rule.contains.some((c) => text.includes(c))) continue;
        hits.set(rule.tech, (hits.get(rule.tech) || 0) + w);
        break;
      }
    }
  }
  return hits;
}

function mergeScores(...maps) {
  const total = new Map();
  for (const m of maps) for (const [k, v] of m) total.set(k, (total.get(k) || 0) + v);
  const sum = [...total.values()].reduce((a, b) => a + b, 0) || 1;
  const rows = [...total.entries()].map(([name, score]) => ({ name, score: Math.round(score * 100) / 100, raw: (score / sum) * 100 }));
  rows.sort((a, b) => b.score - a.score);
  // Plus grand reste : somme des % = 100.
  const floored = rows.map((r) => ({ ...r, percentage: Math.floor(r.raw) }));
  let rest = 100 - floored.reduce((a, r) => a + r.percentage, 0);
  const order = [...floored.keys()].sort((a, b) => floored[b].raw - Math.floor(floored[b].raw) - (floored[a].raw - Math.floor(floored[a].raw)));
  for (const i of order) {
    if (rest <= 0) break;
    floored[i].percentage++;
    rest--;
  }
  return floored.slice(0, 10).map(({ name, score, percentage }) => ({ name, score, percentage }));
}

async function main() {
  const config = readConfig();
  const token = process.env.GITHUB_TOKEN || "";
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "raw-profile-data.json"), "utf8"));
  const projectsData = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "projects.json"), "utf8"));
  const now = new Date();

  const activeDays = config.activeDays ?? 14;
  const allRepos = raw.repos || [];
  const activeRepos = allRepos.filter((r) => !r.fork && !r.archived && r.lastCommit && daysBetween(r.lastCommit, now) < 90);
  const scanRepos = activeRepos.length ? activeRepos : allRepos.filter((r) => !r.fork && !r.archived);

  let scores;
  if (!token || raw.mode === "fixture" || config.githubUsername === "USERNAME") {
    if (!token && raw.mode === "live") log("stack", "no token, detection langage seul (pas de scan fichiers)");
    scores = mergeScores(detectFromLanguage(scanRepos));
  } else {
    const langHits = detectFromLanguage(scanRepos);
    const fileHits = await detectFromFiles(scanRepos.slice(0, 12), config.githubUsername, token);
    scores = mergeScores(langHits, fileHits);
  }

  const commits7d = allRepos.reduce((a, r) => a + (r.commits7d || 0), 0);
  const commits30d = allRepos.reduce((a, r) => a + (r.commits30d || 0), 0);
  const activeCount = allRepos.filter((r) => r.lastCommit && daysBetween(r.lastCommit, now) < activeDays).length;

  const profile = {
    generatedAt: now.toISOString(),
    stats: { publicRepositories: raw.totalPublicRepositories ?? allRepos.length, activeRepositories: activeCount, commits7d, commits30d },
    projects: projectsData.projects || [],
    stack: scores,
  };
  fs.writeFileSync(path.join(__dirname, "..", "data", "profile-data.json"), JSON.stringify(profile, null, 2));
  log("stack", `${scores.length} technologies detected`);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(`[stack] fatal: ${e.message}`);
    process.exit(1);
  });
}

module.exports = { STACK_RULES, repoWeight, detectFromLanguage, mergeScores };
