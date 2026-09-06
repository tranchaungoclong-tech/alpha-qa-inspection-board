import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import webpush from "web-push";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, "data");
const SUBS = path.join(DATA, "subs.json");
const SENT = path.join(DATA, "sent.json");
const KEYS = path.join(DATA, "vapid.json");
const PORT = Number(process.env.PORT || 8787);
const ROOT = path.join(__dirname, "..");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".css": "text/css; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".ico": "image/x-icon"
};
function safeFile(urlPath) {
  const raw = decodeURIComponent(urlPath.split("?")[0]);
  const rel = raw === "/" ? "index.html" : raw.replace(/^\/+/, "");
  const abs = path.normalize(path.join(ROOT, rel));
  if (!abs.startsWith(path.normalize(ROOT + path.sep)) && abs !== path.normalize(ROOT)) return null;
  if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) return null;
  return abs;
}
const HOUR = 20;
const CSV = process.env.SHEET_CSV || "https://docs.google.com/spreadsheets/d/e/2PACX-1vRN1VuOjowpH_lX8LoyFOaXTQ97RDGMcUa4B_R031udAEPssjovgRHynFZVFQPPmRitFKopUZmUlAl5/pub?gid=2026108596&single=true&output=csv";

fs.mkdirSync(DATA, { recursive: true });

function loadJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}
function saveJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function ensureVapid() {
  let keys = loadJson(KEYS, null);
  if (!keys || !keys.publicKey || !keys.privateKey) {
    keys = webpush.generateVAPIDKeys();
    saveJson(KEYS, keys);
    console.log("Generated VAPID keys → data/vapid.json (keep privateKey off GitHub)");
  }
  webpush.setVapidDetails("mailto:qa-board@alpha.local", keys.publicKey, keys.privateKey);
  return keys;
}

const vapid = ensureVapid();
let subs = loadJson(SUBS, []);
let sent = loadJson(SENT, {});

function vnParts(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return { date: `${y}-${m}-${day}`, hour: d.getHours(), minute: d.getMinutes() };
}
function addDays(isoDate, n) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}
function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (ch !== "\r") cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => String(c).trim()));
}
function jobsFromCsv(text) {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const head = rows[0].map(h => String(h || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_"));
  const col = names => names.map(n => head.indexOf(n)).find(i => i >= 0) ?? -1;
  const iDate = col(["date"]);
  const iPic = col(["pic"]);
  const iFac = col(["factory"]);
  const iType = col(["type"]);
  const iCust = col(["customer"]);
  return rows.slice(1).map(r => {
    const get = i => (i >= 0 ? String(r[i] || "").trim() : "");
    const date = get(iDate).slice(0, 10);
    const pic = get(iPic).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!date || !pic) return null;
    return { date, pic, factory: get(iFac), type: get(iType).toLowerCase() || "final", customer: get(iCust) };
  }).filter(Boolean);
}

async function loadJobs() {
  const res = await fetch(CSV + (CSV.includes("?") ? "&" : "?") + "t=" + Date.now(), { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error("csv " + res.status);
  return jobsFromCsv(await res.text());
}

function lineFor(jobs) {
  if (!jobs.length) return "No inspect tomorrow.";
  return jobs.map(j => {
    if (j.type === "leave") return "leave";
    return `${j.factory || "factory"} · ${j.type}${j.customer ? " · " + j.customer : ""}`;
  }).join(" · ");
}

async function sendToPic(pic, title, body, date) {
  const mine = subs.filter(s => s.pic === pic);
  const dead = [];
  for (const s of mine) {
    try {
      await webpush.sendNotification(s.subscription, JSON.stringify({ title, body, date, pic }));
      console.log("sent", pic, date);
    } catch (err) {
      console.log("push fail", pic, err.statusCode || err.message);
      if (err.statusCode === 404 || err.statusCode === 410) dead.push(s);
    }
  }
  if (dead.length) {
    subs = subs.filter(s => !dead.includes(s));
    saveJson(SUBS, subs);
  }
  return mine.length;
}

async function eveningRun(forcePic) {
  const { date: today } = vnParts();
  const tomorrow = addDays(today, 1);
  const key = today;
  console.log("evening tick", today, "hour", vnParts().hour, forcePic ? "force " + forcePic : "");
  if (!forcePic && sent[key]) {
    console.log("already sent evening", key);
    return { ok: true, skipped: true };
  }
  let jobs = [];
  try { jobs = await loadJobs(); }
  catch (err) { console.log("csv fail", err.message); return { ok: false, error: err.message }; }
  const pics = forcePic ? [forcePic] : [...new Set(subs.map(s => s.pic))];
  const result = [];
  for (const pic of pics) {
    const mine = jobs.filter(j => j.pic === pic && j.date === tomorrow);
    const body = mine.length
      ? `Tomorrow ${tomorrow}: ${lineFor(mine)}`
      : `Tomorrow ${tomorrow}: no inspect on the sheet.`;
    const n = await sendToPic(pic, "QA Board — tomorrow", body, tomorrow);
    result.push({ pic, n, jobs: mine.length });
  }
  if (!forcePic) {
    sent[key] = { at: new Date().toISOString(), result };
    saveJson(SENT, sent);
  }
  return { ok: true, today, tomorrow, result };
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type, Bypass-Tunnel-Reminder");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let buf = "";
    req.on("data", c => { buf += c; if (buf.length > 1e6) req.destroy(); });
    req.on("end", () => {
      try { resolve(buf ? JSON.parse(buf) : {}); } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  const url = new URL(req.url, "http://localhost");
  try {
    if (req.method === "GET" && url.pathname === "/vapidPublicKey") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ publicKey: vapid.publicKey }));
      return;
    }
    if (req.method === "GET" && url.pathname === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, subs: subs.length, vn: vnParts() }));
      return;
    }
    if (req.method === "POST" && url.pathname === "/subscribe") {
      const body = await readBody(req);
      const pic = String(body.pic || "").toLowerCase();
      const subscription = body.subscription;
      if (!pic || !subscription || !subscription.endpoint) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "pic + subscription required" }));
        return;
      }
      subs = subs.filter(s => s.subscription.endpoint !== subscription.endpoint);
      subs.push({ pic, subscription, at: new Date().toISOString() });
      saveJson(SUBS, subs);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, pic, n: subs.filter(s => s.pic === pic).length }));
      return;
    }
    if (req.method === "POST" && url.pathname === "/test") {
      const body = await readBody(req);
      const pic = String(body.pic || "").toLowerCase();
      if (!pic) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "pic required" }));
        return;
      }
      const out = await eveningRun(pic);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(out));
      return;
    }
    if (req.method === "GET") {
      const file = safeFile(url.pathname);
      if (file) {
        const ext = path.extname(file).toLowerCase();
        res.writeHead(200, { "content-type": MIME[ext] || "application/octet-stream" });
        fs.createReadStream(file).pipe(res);
        return;
      }
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  } catch (err) {
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: String(err.message || err) }));
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("QA notify server http://localhost:" + PORT);
  console.log("VAPID public:", vapid.publicKey);
});

function maybeEveningTick() {
  const { hour } = vnParts();
  if (hour >= HOUR) eveningRun().catch(err => console.log(err));
}
setTimeout(maybeEveningTick, 8000);
setInterval(maybeEveningTick, 60 * 1000);
