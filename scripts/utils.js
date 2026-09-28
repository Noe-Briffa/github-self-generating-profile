const fs = require("fs");
const path = require("path");

function log(tag, msg) {
  console.log(`[${tag}] ${msg}`);
}

function readConfig() {
  const p = path.join(__dirname, "..", "config", "profile.config.json");
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function daysAgoISO(days, now = new Date()) {
  return new Date(now.getTime() - days * 86400000).toISOString();
}

function daysBetween(isoDate, now = new Date()) {
  const t = new Date(isoDate).getTime();
  if (Number.isNaN(t)) return Infinity;
  return (now.getTime() - t) / 86400000;
}

function escapeXml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncate(s, n) {
  const v = String(s ?? "").replace(/\s+/g, " ").trim();
  return v.length > n ? v.slice(0, n - 1) + "…" : v;
}

async function fetchJson(url, token) {
  const headers = { "User-Agent": "github-self-generating-profile", Accept: "application/vnd.github+json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  if (res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0") {
    const reset = res.headers.get("x-ratelimit-reset");
    throw new Error(`rate-limit reset=${reset}`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

module.exports = { log, readConfig, daysAgoISO, daysBetween, escapeXml, truncate, fetchJson };
