const fs = require("fs");
const path = require("path");
const { log, readConfig, escapeXml, truncate, daysBetween } = require("./utils");

function timeAgo(iso, now = new Date()) {
  if (!iso) return "—";
  const d = daysBetween(iso.length === 10 ? iso + "T00:00:00Z" : iso, now);
  if (!Number.isFinite(d) || d < 0) return "—";
  if (d < 1) return "today";
  if (d < 2) return "1d ago";
  return `${Math.floor(d)}d ago`;
}

function bar(pct, width = 18) {
  const n = Math.max(0, Math.min(width, Math.round((pct / 100) * width)));
  return "█".repeat(n) + "░".repeat(width - n);
}

function projectRows(projects, y0, now, maxProjects = 4) {
  if (!projects.length) {
    return { svg: `<text x="40" y="${y0}" class="dim">No active project — check back soon.</text>`, height: 30 };
  }
  let y = y0;
  let s = "";
  projects.slice(0, maxProjects).forEach((p, i) => {
    const num = String(i + 1).padStart(2, "0");
    const name = escapeXml(truncate(p.name || "unnamed", 30));
    const desc = escapeXml(truncate(p.description || "No description", 80));
    const meta = escapeXml(`${p.commits7d ?? 0} commits/7d · ${p.commits30d ?? 0}/30d · updated ${timeAgo(p.lastCommit, now)} · ${p.primaryLanguage || "—"} · ${p.status || ""}`);
    const dot = p.status === "ACTIVE" ? "#3fb950" : p.status === "MAINTAINED" ? "#d29922" : "#6e7681";
    const url = String(p.url || "");
    const safe = url.startsWith("https://") ? escapeXml(url) : "";
    const open = safe ? `<a href="${safe}" target="_blank">` : "";
    const close = safe ? `</a>` : "";
    s += `<text x="40" y="${y}" class="pnum">${num}</text>`
      + `<circle cx="78" cy="${y - 4}" r="4" fill="${dot}"><animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite"/></circle>`
      + `${open}<text x="92" y="${y}" class="pname">${name}</text>${close}`
      + `<text x="92" y="${y + 18}" class="dim">${desc}</text>`
      + `<text x="92" y="${y + 34}" class="meta">${meta}</text>`;
    y += 58;
  });
  return { svg: s, height: y - y0 };
}

function stackRows(stack, y0) {
  if (!stack.length) {
    return { svg: `<text x="40" y="${y0}" class="dim">No technology detected yet.</text>`, height: 30 };
  }
  let y = y0;
  let s = "";
  for (const t of stack.slice(0, 8)) {
    const name = escapeXml(truncate(t.name || "?", 14).padEnd(14, " "));
    s += `<text x="40" y="${y}" class="stack">${name}  ${bar(t.percentage || 0)} ${(t.percentage || 0)}%</text>`;
    y += 26;
  }
  return { svg: s, height: y - y0 };
}

function render(data, config, now = new Date()) {
  const username = escapeXml((config.githubUsername || "USERNAME").toUpperCase());
  const stats = data.stats || {};
  const gen = new Date(data.generatedAt || now.toISOString());
  const updated = `${String(gen.getUTCDate()).padStart(2, "0")} ${gen.toLocaleString("en-GB", { month: "short", timeZone: "UTC" })} ${gen.getUTCFullYear()} · ${String(gen.getUTCHours()).padStart(2, "0")}:${String(gen.getUTCMinutes()).padStart(2, "0")} UTC`;

  const yBuild = 170;
  const b = projectRows(data.projects || [], yBuild, now, config.maxProjects ?? 4);
  const yAct = yBuild + b.height + 30;
  const yStack = yAct + 110;
  const st = stackRows(data.stack || [], yStack + 30);
  const H = Math.ceil(yStack + 30 + st.height + 60);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="${H}" viewBox="0 0 800 ${H}" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" role="img">
<style>
:root { --bg: #0d1117; --panel: #161b22; --text: #e6edf3; --dim: #8b949e; --line: #30363d; --accent: #58a6ff; }
@media (prefers-color-scheme: light) { :root { --bg: #ffffff; --panel: #f6f8fa; --text: #1f2328; --dim: #59636e; --line: #d0d7de; --accent: #0969da; } }
.bg { fill: var(--bg); } .panel { fill: var(--panel); stroke: var(--line); }
text { fill: var(--text); font-size: 14px; } .dim { fill: var(--dim); font-size: 12px; }
.meta { fill: var(--dim); font-size: 11px; } .title { fill: var(--dim); font-size: 11px; letter-spacing: 2px; }
.name { font-size: 26px; font-weight: 700; } .tag { fill: var(--accent); font-size: 12px; letter-spacing: 3px; }
.pnum { fill: var(--dim); } .pname { font-weight: 700; } .stack { font-size: 13px; }
.stat { font-size: 22px; font-weight: 700; } .cursor { animation: blink 1.1s steps(1) infinite; }
@keyframes blink { 50% { opacity: 0; } }
.bar-anim { animation: grow 0.8s ease-out; transform-origin: left; }
@keyframes grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
</style>
<rect class="bg" width="800" height="${H}" rx="12"/>
<rect class="panel" x="16" y="16" width="768" height="${H - 32}" rx="8"/>
<text x="40" y="60" class="name">${username}</text>
<text x="40" y="82" class="tag">AI SYSTEMS · CYBERSECURITY · ENGINEERING</text>
<text x="40" y="112" class="title">SYSTEM STATUS <tspan class="cursor">▊</tspan></text>
<line x1="40" y1="122" x2="760" y2="122" stroke-width="1" style="stroke: var(--line)"/>
<text x="40" y="${yBuild - 14}" class="title">CURRENTLY BUILDING</text>
${b.svg}
<text x="40" y="${yAct}" class="title">ACTIVITY</text>
<text x="40" y="${yAct + 30}" class="dim">Commits / 7d</text><text x="40" y="${yAct + 56}" class="stat">${stats.commits7d ?? 0}</text>
<text x="240" y="${yAct + 30}" class="dim">Commits / 30d</text><text x="240" y="${yAct + 56}" class="stat">${stats.commits30d ?? 0}</text>
<text x="440" y="${yAct + 30}" class="dim">Active repos</text><text x="440" y="${yAct + 56}" class="stat">${stats.activeRepositories ?? 0}</text>
<text x="620" y="${yAct + 30}" class="dim">Public repos</text><text x="620" y="${yAct + 56}" class="stat">${stats.publicRepositories ?? 0}</text>
<text x="40" y="${yStack}" class="title">CURRENT STACK</text>
<g class="bar-anim">${st.svg}</g>
<text x="40" y="${H - 28}" class="meta">LAST UPDATED — ${escapeXml(updated)}</text>
</svg>`;
}

async function main() {
  const config = readConfig();
  const dataPath = path.join(__dirname, "..", "data", "profile-data.json");
  const outPath = path.join(__dirname, "..", "assets", "profile.svg");
  const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  fs.writeFileSync(outPath, render(data, config, new Date()));
  log("render", "profile.svg generated");
}

if (require.main === module) {
  main().catch((e) => {
    console.error(`[render] fatal: ${e.message}`);
    process.exit(1);
  });
}

module.exports = { render, timeAgo, bar, projectRows, stackRows };
