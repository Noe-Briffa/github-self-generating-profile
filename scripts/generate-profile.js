const fs = require("fs");
const path = require("path");
const { log, readConfig, escapeXml, truncate, daysBetween } = require("./utils");

function timeAgo(iso, now = new Date()) {
  if (!iso) return "-";
  const d = daysBetween(iso.length === 10 ? iso + "T00:00:00Z" : iso, now);
  if (!Number.isFinite(d) || d < 0) return "-";
  if (d < 1) return "today";
  if (d < 2) return "1d ago";
  return `${Math.floor(d)}d ago`;
}

function projectRows(projects, y0, now, maxProjects = 4) {
  if (!projects.length) {
    return { svg: `<text x="40" y="${y0}" class="dim">No active project - check back soon.</text>`, height: 30 };
  }
  let y = y0;
  let s = "";
  projects.slice(0, maxProjects).forEach((p, i) => {
    const num = String(i + 1).padStart(2, "0");
    const name = escapeXml(truncate(p.name || "unnamed", 30));
    const desc = escapeXml(truncate(p.description || "No description", 80));
    const meta = escapeXml(`${p.commits7d ?? 0} commits/7d · ${p.commits30d ?? 0}/30d · updated ${timeAgo(p.lastCommit, now)} · ${p.primaryLanguage || "-"} · ${p.status || ""}`);
    const dot = p.status === "ACTIVE" ? "#3fb950" : p.status === "MAINTAINED" ? "#d29922" : "#6e7681";
    const url = String(p.url || "");
    const safe = url.startsWith("https://") ? escapeXml(url) : "";
    const open = safe ? `<a href="${safe}" target="_blank">` : "";
    const close = safe ? `</a>` : "";
    s += `<text x="40" y="${y}" class="pnum">${num}</text>`
      + `<circle cx="78" cy="${y - 4}" r="4" fill="${dot}"/>`
      + `${open}<text x="92" y="${y}" class="pname">${name}</text>${close}`
      + `<text x="92" y="${y + 18}" class="dim">${desc}</text>`
      + `<text x="92" y="${y + 34}" class="meta">${meta}</text>`;
    y += 58;
  });
  return { svg: s, height: y - y0 };
}

function portraitBlock(config) {
  // Fichier ASCII pre-genere (assets/portrait-*.txt), null = pas de portrait.
  if (!config.portrait) return { svg: "", bottom: 0 };
  try {
    const p = path.join(__dirname, "..", "assets", config.portrait);
    const lines = fs.readFileSync(p, "utf8").replace(/\r/g, "").split("\n").filter((l) => l.length);
    if (!lines.length) return { svg: "", bottom: 0 };
    const cols = Math.max(...lines.map((l) => l.length));
    const fs_ = cols > 40 ? 7 : 11; // fine menu, block gros
    const lh = fs_ + 1.4;
    const x = 800 - 24 - cols * fs_ * 0.6;
    let s = "";
    lines.forEach((l, i) => {
      s += `<text x="${x.toFixed(1)}" y="${(44 + i * lh).toFixed(1)}" class="portrait" font-size="${fs_}">${escapeXml(l)}</text>`;
    });
    return { svg: s, bottom: 44 + lines.length * lh };
  } catch (_) {
    return { svg: "", bottom: 0 };
  }
}

function asciiBanner(filename, fs_, fitScale = 1, typewriter = false) {
  // Section ASCII pleine largeur, fichier pre-genere.
  const typingSeconds = 5;
  try {
    const p = path.join(__dirname, "..", "assets", filename);
    const lines = fs.readFileSync(p, "utf8").replace(/\r/g, "").split("\n").filter((l) => l.length);
    if (!lines.length) return { svg: "", height: 0 };
    const cols = Math.max(...lines.map((l) => l.length));
    fs_ = Math.min(fs_, (fitScale * 700) / (cols * 0.6)); // tient garanti dans 720px
    const lh = fs_ * 1.2;
    const w = (cols * fs_ * 0.6).toFixed(1);
    const x = ((800 - cols * fs_ * 0.6) / 2).toFixed(1); // centre
    let s = "";
    lines.forEach((l, i) => {
      const attrs = typewriter ? ` class="portrait typing-row" style="--type-delay:${(i * typingSeconds / lines.length).toFixed(4)}s"` : ` class="portrait"`;
      s += `<text x="${x}" y="${(i * lh).toFixed(1)}"${attrs} font-size="${fs_.toFixed(2)}" textLength="${w}" lengthAdjust="spacingAndGlyphs">${escapeXml(l)}</text>`;
    });
    return { svg: s, height: lines.length * lh, columns: cols, duration: typingSeconds / lines.length };
  } catch (_) {
    return { svg: "", height: 0 };
  }
}

function mosaicSection(cell = 8) {
  // Mosaique photo en <rect> gris, pre-calculee (assets/portrait-mosaic.json).
  try {
    const p = path.join(__dirname, "..", "assets", "portrait-mosaic.json");
    const m = JSON.parse(fs.readFileSync(p, "utf8"));
    const W = m.cols * cell;
    const x0 = (800 - W) / 2;
    let s = "";
    for (let r = 0; r < m.rows; r++) {
      for (let c = 0; c < m.cols; c++) {
        const v = Math.max(0, Math.min(255, m.cells[r][c]));
        s += `<rect x="${(x0 + c * cell).toFixed(1)}" y="${(r * cell).toFixed(1)}" width="${cell}" height="${cell}" fill="rgb(${v},${v},${v})"/>`;
      }
    }
    return { svg: s, height: m.rows * cell };
  } catch (_) {
    return { svg: "", height: 0 };
  }
}

function pixelsBlock(filename = "portrait-pixels.png") {
  // PNG pixelise (assets/portrait-pixels*.png) inline en data URI, upscale net.
  // Meme convention que asciiBanner : position relative, sans label.
  try {
    const p = path.join(__dirname, "..", "assets", filename);
    if (!fs.existsSync(p)) return { svg: "", height: 0 };
    const b64 = fs.readFileSync(p).toString("base64");
    const H = 700;
    const svg = `<image x="10" y="0" width="700" height="${H}" href="data:image/png;base64,${b64}" style="image-rendering:pixelated"/>`;
    return { svg, height: H };
  } catch (_) {
    return { svg: "", height: 0 };
  }
}

function stackRows(stack, projects, y0) {
  const languages = stack.slice(0, 6).map((tech) => escapeXml(truncate(tech.name || "?", 12)));
  const languageLines = [];
  for (let i = 0; i < languages.length; i += 3) languageLines.push(languages.slice(i, i + 3).join(" · "));
  if (!languageLines.length) languageLines.push("No languages detected");
  const computerVision = projects.some((project) => /image-colorization-nn|computer vision|colori[sz]ation/i.test(`${project.name} ${project.description}`));
  const languageSvg = languageLines.map((line, i) => `<text x="40" y="${y0 + i * 24}" class="stack">${i === 0 ? "Languages in public projects: " : ""}${line}</text>`).join("");
  return {
    svg: languageSvg + (computerVision ? `<text x="40" y="${y0 + languageLines.length * 24}" class="stack">AI project: computer vision</text>` : ""),
    height: (languageLines.length + (computerVision ? 1 : 0)) * 24,
  };
}

function render(data, config, now = new Date()) {
  const username = escapeXml((config.githubUsername || "USERNAME").toUpperCase());
  const stats = data.stats || {};
  const gen = new Date(data.generatedAt || now.toISOString());
  const updated = `${String(gen.getUTCDate()).padStart(2, "0")} ${gen.toLocaleString("en-GB", { month: "short", timeZone: "UTC" })} ${gen.getUTCFullYear()} · ${String(gen.getUTCHours()).padStart(2, "0")}:${String(gen.getUTCMinutes()).padStart(2, "0")} UTC`;

  const mode = config.portrait || null;
  let headerPortrait = { svg: "", bottom: 0 };
  let topSection = { svg: "", height: 0 };
  let bottomSection = { svg: "", height: 0 };
  if (mode === "fine" || mode === "block") {
    headerPortrait = portraitBlock({ portrait: mode === "fine" ? "portrait-fine.txt" : "portrait-block.txt" });
  } else if (mode === "wide") {
    topSection = asciiBanner("portrait-wide.txt", 10, 1);
  } else if (mode === "full") {
    topSection = asciiBanner("portrait-full.txt", 10, 1, true);
  } else if (mode === "pixels") {
    topSection = pixelsBlock("portrait-pixels.png");
  } else if (mode === "pixels-bw") {
    topSection = pixelsBlock("portrait-pixels-bw.png");
  } else if (mode === "pixels-bw320") {
    topSection = pixelsBlock("portrait-pixels-bw320.png");
  } else if (mode === "dot160") {
    topSection = pixelsBlock("portrait-pixels-dot160.png");
  } else if (mode === "dot320") {
    topSection = pixelsBlock("portrait-pixels-dot320.png");
  } else if (mode === "bw160") {
    topSection = pixelsBlock("portrait-bw160.png");
  } else if (mode === "bw320") {
    topSection = pixelsBlock("portrait-bw320.png");
  } else if (mode === "mosaic") {
    topSection = mosaicSection(8);
  } else if (mode === "combo") {
    headerPortrait = portraitBlock({ portrait: "portrait-block.txt" });
    bottomSection = asciiBanner("portrait-wide.txt", 10, 1);
  }
  if (mode === "full" && !topSection.height) throw new Error("Missing portrait source: assets/portrait-full.txt");
  const learning = [
    "Security governance & risk",
    "Systems hardening",
    "Network & modern architecture security",
    "Cyber investigation & OSINT",
    "Incident response & business continuity",
    "Cybersecurity law & regulation",
  ];
  const learningSvg = learning.map((item, i) => {
    const col = i < 3 ? 40 : 410;
    const row = i % 3;
    return `<text x="${col}" y="${208 + row * 24}" class="learning">${escapeXml(item)}</text>`;
  }).join("");
  const focusSvg = [
    "Infrastructure & cloud · Identity and access management · Security auditing",
    "Cyber investigation & OSINT · Risk and governance · Incident response",
  ].map((item, i) => `<text x="40" y="${326 + i * 24}" class="focus">${escapeXml(item)}</text>`).join("");
  const projectsY = 408;
  const b = projectRows(data.projects || [], projectsY, now, config.maxProjects ?? 4);
  const yStack = projectsY + b.height + 48;
  const st = stackRows(data.stack || [], data.projects || [], yStack + 28);
  const yPortrait = yStack + 28 + st.height + 26;
  const mainPortrait = topSection.height > 0 ? topSection : headerPortrait;
  const mainPortraitHeight = topSection.height > 0 ? topSection.height : Math.max(0, headerPortrait.bottom - 44);
  const mainPortraitTranslate = topSection.height > 0 ? yPortrait + 18 : yPortrait + 18 - 44;
  const portraitSvg = mainPortraitHeight > 0
    ? `<text x="40" y="${yPortrait}" class="title">PORTRAIT</text><g transform="translate(0,${mainPortraitTranslate})" aria-hidden="true">${mainPortrait.svg}</g>`
    : "";
  const portraitHeight = mainPortraitHeight > 0 ? mainPortraitHeight + 18 : 0;
  const yBottomPortrait = yPortrait + portraitHeight + 30;
  const bottomPortraitSvg = bottomSection.height > 0
    ? `<text x="40" y="${yBottomPortrait}" class="title">PORTRAIT</text><g transform="translate(0,${yBottomPortrait + 18})" aria-hidden="true">${bottomSection.svg}</g>`
    : "";
  const yAct = yBottomPortrait + (bottomSection.height > 0 ? 18 + bottomSection.height : 0) + 30;
  const H = Math.ceil(yAct + 120);
  const typingCss = mode === "full" && topSection.height > 0 ? `.typing-row { animation: type-line ${topSection.duration.toFixed(4)}s steps(${topSection.columns}, end) var(--type-delay) both; }` : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="${H}" viewBox="0 0 800 ${H}" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" role="img">
<title>${username} - GitHub profile</title>
<style>
:root { --bg: #0d1117; --panel: #161b22; --text: #e6edf3; --dim: #8b949e; --line: #30363d; --accent: #58a6ff; }
.bg { fill: var(--bg); } .panel { fill: var(--panel); stroke: var(--line); }
text { fill: var(--text); font-size: 14px; } .dim { fill: var(--dim); font-size: 12px; }
.meta { fill: var(--dim); font-size: 11px; } .title { fill: var(--dim); font-size: 11px; letter-spacing: 2px; }
.name { font-size: 26px; font-weight: 700; } .tag { fill: var(--accent); font-size: 12px; letter-spacing: 2px; }
.pnum { fill: var(--dim); } .pname { font-weight: 700; } .stack { font-size: 13px; }
.intro { fill: var(--text); font-size: 12px; } .learning, .focus { fill: var(--text); font-size: 12px; }
.portrait { fill: var(--dim); white-space: pre; }
.stat { font-size: 22px; font-weight: 700; } .cursor { animation: blink 1.1s steps(1) infinite; }
@keyframes blink { 50% { opacity: 0; } }
${typingCss}
@keyframes type-line { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
@media (prefers-reduced-motion: reduce) { .typing-row, .cursor { animation: none; } }
</style>
<rect class="bg" width="800" height="${H}" rx="12"/>
<rect class="panel" x="16" y="16" width="768" height="${H - 32}" rx="8"/>
<text x="40" y="60" class="name">${username}</text>
<text x="40" y="82" class="tag">CYBERSECURITY · SECURITY ENGINEERING IN TRAINING · AI SYSTEMS</text>
<text x="40" y="112" class="intro">Computer Engineering student @ UTT, pursuing the Master SSI.</text>
<text x="40" y="132" class="intro">Exploring security engineering and cyber investigation; building software and AI systems.</text>
<line x1="40" y1="150" x2="760" y2="150" stroke-width="1" style="stroke: var(--line)"/>
<text x="40" y="180" class="title">CURRENTLY LEARNING — MASTER SSI @ UTT</text>
${learningSvg}
<text x="40" y="298" class="title">CYBERSECURITY FOCUS AREAS</text>
${focusSvg}
<text x="40" y="390" class="title">CURRENTLY BUILDING</text>
${b.svg}
<text x="40" y="${yStack}" class="title">TECHNICAL TOOLBOX</text>
${st.svg}
${portraitSvg}
${bottomPortraitSvg}
<text x="40" y="${yAct}" class="title">ACTIVITY</text>
<text x="40" y="${yAct + 30}" class="dim">Commits / 7d</text><text x="40" y="${yAct + 56}" class="stat">${stats.commits7d ?? 0}</text>
<text x="240" y="${yAct + 30}" class="dim">Commits / 30d</text><text x="240" y="${yAct + 56}" class="stat">${stats.commits30d ?? 0}</text>
<text x="440" y="${yAct + 30}" class="dim">Active repos</text><text x="440" y="${yAct + 56}" class="stat">${stats.activeRepositories ?? 0}</text>
<text x="620" y="${yAct + 30}" class="dim">Public repos</text><text x="620" y="${yAct + 56}" class="stat">${stats.publicRepositories ?? 0}</text>
<text x="40" y="${H - 28}" class="meta">LAST UPDATED - ${escapeXml(updated)}</text>
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

module.exports = { render, timeAgo, projectRows, stackRows, portraitBlock };
