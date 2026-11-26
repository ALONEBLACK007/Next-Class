// Next Class — Backend
// Node.js ล้วน ไม่มี dependency: http + SQLite ในตัว (node:sqlite) + scrypt สำหรับรหัสผ่าน
// รัน:  node backEnd/server.js            แล้วเปิด http://localhost:3000
//       node backEnd/server.js --reset-admin   คืนรหัสแอดมินเป็น admin/admin (ต้องเปลี่ยนเมื่อเข้าครั้งแรก)
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.resolve(__dirname, '..');
const DB_FILE = process.env.NC_DB || path.join(__dirname, 'data', 'nextclass.db');
const PORT = +process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const INDEX = 'น้องไทม์ AI – ระบบจัดตารางสอนอัตโนมัติ.html';
const SESSION_DAYS = 7;
const DEFAULT_PW = '1234';
const MAX_BODY = 30 * 1024 * 1024;

// ---------- ฐานข้อมูล ----------
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
const db = new DatabaseSync(DB_FILE);
db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name  TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin','teacher','student')),
  teacher_name  TEXT,
  group_name    TEXT,
  student_id    TEXT,
  pass_hash     TEXT NOT NULL,
  must_change   INTEGER NOT NULL DEFAULT 1,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_login    TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at  INTEGER NOT NULL,
  ip          TEXT
);
CREATE TABLE IF NOT EXISTS datasets (
  id          INTEGER PRIMARY KEY,
  data_json   TEXT NOT NULL,
  raw_json    TEXT NOT NULL DEFAULT '{}',
  summary     TEXT,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  active      INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS timetables (
  id               INTEGER PRIMARY KEY,
  dataset_id       INTEGER REFERENCES datasets(id) ON DELETE SET NULL,
  source           TEXT NOT NULL,
  seed             TEXT,
  meta_json        TEXT NOT NULL,
  hard_violations  INTEGER,
  placed           INTEGER,
  total            INTEGER,
  soft_cost        REAL,
  created_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT,
  active           INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS timetable_entries (
  id            INTEGER PRIMARY KEY,
  timetable_id  INTEGER NOT NULL REFERENCES timetables(id) ON DELETE CASCADE,
  slot          INTEGER NOT NULL,
  day           INTEGER NOT NULL,
  period        INTEGER NOT NULL,
  subject_code  TEXT NOT NULL,
  subject_name  TEXT,
  group_name    TEXT NOT NULL,
  teacher       TEXT,
  room          TEXT,
  kind          TEXT
);
CREATE INDEX IF NOT EXISTS ix_entries_tt      ON timetable_entries(timetable_id);
CREATE INDEX IF NOT EXISTS ix_entries_group   ON timetable_entries(timetable_id, group_name);
CREATE INDEX IF NOT EXISTS ix_entries_teacher ON timetable_entries(timetable_id, teacher);
CREATE INDEX IF NOT EXISTS ix_entries_room    ON timetable_entries(timetable_id, room);
CREATE TABLE IF NOT EXISTS notes (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL CHECK (kind IN ('room','teacher','group')),
  target      TEXT NOT NULL,
  slots_json  TEXT NOT NULL,
  note        TEXT NOT NULL,
  blocking    INTEGER NOT NULL DEFAULT 1,
  created_by  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT
);
CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value_json  TEXT NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS audit_log (
  id        INTEGER PRIMARY KEY,
  at        TEXT NOT NULL DEFAULT (datetime('now')),
  user_id   INTEGER,
  username  TEXT,
  action    TEXT NOT NULL,
  detail    TEXT,
  ip        TEXT
);
`);

const tx = fn => { db.exec('BEGIN'); try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } };
const plain = o => (o ? { ...o } : o);

// ---------- รหัสผ่าน (scrypt + salt แยกแต่ละบัญชี) ----------
const scrypt = promisify(crypto.scrypt);
const SCRYPT = { N: 16384, r: 8, p: 1 };
async function hashPw(pw) {
  const salt = crypto.randomBytes(16);
  const h = await scrypt(String(pw), salt, 64, SCRYPT);
  return `scrypt$${salt.toString('base64')}$${h.toString('base64')}`;
}
async function checkPw(pw, stored) {
  const [alg, s, h] = String(stored || '').split('$');
  if (alg !== 'scrypt' || !s || !h) return false;
  const want = Buffer.from(h, 'base64');
  const got = await scrypt(String(pw), Buffer.from(s, 'base64'), want.length, SCRYPT);
  return crypto.timingSafeEqual(want, got);
}

// ---------- บัญชีแอดมินเริ่มต้น ----------
async function ensureAdmin(reset) {
  const row = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
  const h = await hashPw('admin');
  if (!row) {
    db.prepare("INSERT INTO users (username, display_name, role, pass_hash, must_change) VALUES ('admin','ผู้ดูแลระบบ','admin',?,1)").run(h);
    console.log('สร้างบัญชีแอดมินเริ่มต้น admin / admin (ต้องเปลี่ยนรหัสเมื่อเข้าครั้งแรก)');
  } else if (reset) {
    db.prepare("UPDATE users SET pass_hash = ?, must_change = 1, active = 1, role = 'admin' WHERE id = ?").run(h, row.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.id);
    console.log('รีเซ็ตรหัสแอดมินเป็น admin / admin แล้ว');
  }
}

// ---------- session ----------
const sha = t => crypto.createHash('sha256').update(t).digest('hex');
function newSession(userId, ip) {
  const token = crypto.randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, ip) VALUES (?,?,?,?)').run(sha(token), userId, Date.now() + SESSION_DAYS * 864e5, ip);
  return token;
}
function cookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); });
  return out;
}
function sessionUser(req) {
  const t = cookies(req).nc_sid;
  if (!t) return null;
  const row = db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1`).get(sha(t), Date.now());
  return plain(row);
}
const cookieFor = (req, token, maxAge) => `nc_sid=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''}`;
const pubUser = u => ({ id: u.id, username: u.username, display_name: u.display_name, role: u.role, teacher_name: u.teacher_name, group_name: u.group_name, student_id: u.student_id, must_change: !!u.must_change });

// ---------- กันเดารหัส ----------
const fails = new Map();
function tooMany(ip) { const f = fails.get(ip); return f && f.n >= 10 && Date.now() - f.t < 10 * 60e3; }
function addFail(ip) { const f = fails.get(ip); if (!f || Date.now() - f.t > 10 * 60e3) fails.set(ip, { n: 1, t: Date.now() }); else f.n++; }

// ---------- audit ----------
function audit(req, user, action, detail) {
  db.prepare('INSERT INTO audit_log (user_id, username, action, detail, ip) VALUES (?,?,?,?,?)').run(user ? user.id : null, user ? user.username : null, action, detail == null ? null : String(detail).slice(0, 500), req.ip);
}

// ---------- ข้อมูลกลาง ----------
const activeDataset = () => plain(db.prepare('SELECT * FROM datasets WHERE active = 1 ORDER BY id DESC LIMIT 1').get());
const activeTimetable = () => plain(db.prepare('SELECT * FROM timetables WHERE active = 1 ORDER BY id DESC LIMIT 1').get());
function slotsOf(ds) { try { const s = ds && JSON.parse(ds.data_json).slots; return { P: (s && s.P) || 8, lunch: s && s.lunch != null ? s.lunch : 4 }; } catch { return { P: 8, lunch: 4 }; } }

function cleanRows(rows, S) {
  if (!Array.isArray(rows) || rows.length > 50000) throw httpErr(400, 'รูปแบบตารางไม่ถูกต้อง');
  const out = [];
  for (const r of rows) {
    const slot = Number(r && r.slot);
    if (!Number.isInteger(slot) || slot < 0 || slot >= 5 * S.P || !r.code || !r.group) throw httpErr(400, 'ข้อมูลคาบไม่ครบหรือไม่ถูกต้อง');
    if (slot % S.P === S.lunch) throw httpErr(422, `ห้ามมีคาบเรียนในคาบพักเที่ยง (คาบ ${S.lunch + 1}) — ${r.code} ${r.group}`);
    out.push({ slot, code: String(r.code).slice(0, 80), name: r.name == null ? null : String(r.name).slice(0, 200), group: String(r.group).slice(0, 120), teacher: r.teacher == null ? null : String(r.teacher).slice(0, 120), room: r.room == null ? null : String(r.room).slice(0, 120), kind: r.kind === 't' || r.kind === 'p' ? r.kind : null });
  }
  return out;
}
function putEntries(ttId, rows, S) {
  const ins = db.prepare('INSERT INTO timetable_entries (timetable_id, slot, day, period, subject_code, subject_name, group_name, teacher, room, kind) VALUES (?,?,?,?,?,?,?,?,?,?)');
  for (const r of rows) ins.run(ttId, r.slot, Math.floor(r.slot / S.P), (r.slot % S.P) + 1, r.code, r.name, r.group, r.teacher, r.room, r.kind);
}
function summaryOf(m) { return m && typeof m === 'object' ? { hard: m.hard && typeof m.hard === 'object' ? m.hard.total : m.hard, placed: m.placed, total: m.total, cost: m.cost } : {}; }
const num = v => (Number.isFinite(+v) ? +v : null);

function getState(user) {
  const ds = activeDataset(), tt = activeTimetable();
  let data = ds ? JSON.parse(ds.data_json) : null, raw = ds ? JSON.parse(ds.raw_json) : {};
  if (data && user.role !== 'admin') {
    data = { ...data, students: user.role === 'student' && user.student_id ? (data.students || []).filter(s => s.student_id === user.student_id) : [] };
    raw = {};
  }
  let t = null;
  if (tt) {
    const rows = db.prepare('SELECT slot, subject_code AS code, subject_name AS name, group_name AS "group", teacher, room, kind FROM timetable_entries WHERE timetable_id = ? ORDER BY slot, id').all(tt.id)
      .map(r => { const o = { ...r }; if (o.kind == null) delete o.kind; return o; });
    t = { ...JSON.parse(tt.meta_json), rows, serverId: tt.id };
    if (user.role !== 'admin') delete t.log;
  }
  const blocks = db.prepare('SELECT * FROM notes ORDER BY created_at, id').all().map(n => ({ id: n.id, kind: n.kind, target: n.target, slots: JSON.parse(n.slots_json), note: n.note, free: !n.blocking, by: n.created_by || undefined }));
  const w = db.prepare("SELECT value_json FROM settings WHERE key = 'weights'").get();
  return { data, raw, tt: t, blocks, W: w ? JSON.parse(w.value_json) : null, datasetId: ds ? ds.id : null, timetableId: tt ? tt.id : null };
}

// สร้างบัญชีครู/นักเรียนจากชุดข้อมูล (บัญชีเดิมไม่ถูกเขียนทับรหัสผ่าน)
async function syncAccounts(data) {
  const want = [], seen = new Set();
  const add = o => { const k = String(o.username || '').trim().toLowerCase(); if (!k || seen.has(k)) return; seen.add(k); want.push({ ...o, username: String(o.username).trim() }); };
  (data.teachers || []).forEach(t => add({ username: t.id || t.name, display_name: t.name || t.id, role: 'teacher', teacher_name: t.name || null }));
  (data.students || []).forEach(s => add({ username: s.student_id, display_name: s.name || s.student_id, role: 'student', group_name: s.group || null, student_id: s.student_id }));
  (data.groups || []).forEach(g => add({ username: g.id || g.name, display_name: g.name || g.id, role: 'student', group_name: g.name || null }));
  const exist = new Map(db.prepare('SELECT id, username, role FROM users').all().map(u => [u.username.toLowerCase(), u]));
  const create = want.filter(w => !exist.has(w.username.toLowerCase()));
  const hashes = await Promise.all(create.map(() => hashPw(DEFAULT_PW)));
  let updated = 0;
  tx(() => {
    const ins = db.prepare('INSERT INTO users (username, display_name, role, teacher_name, group_name, student_id, pass_hash, must_change) VALUES (?,?,?,?,?,?,?,1)');
    create.forEach((w, i) => ins.run(w.username, w.display_name, w.role, w.teacher_name || null, w.group_name || null, w.student_id || null, hashes[i]));
    const upd = db.prepare('UPDATE users SET display_name = ?, teacher_name = ?, group_name = ?, student_id = COALESCE(?, student_id) WHERE id = ? AND role = ?');
    want.forEach(w => { const e = exist.get(w.username.toLowerCase()); if (e && e.role === w.role) { upd.run(w.display_name, w.teacher_name || null, w.group_name || null, w.student_id || null, e.id, w.role); updated++; } });
  });
  return { created: create.length, updated };
}

// ---------- HTTP helpers ----------
function httpErr(status, msg) { const e = new Error(msg); e.status = status; return e; }
function send(res, status, obj, headers = {}) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > MAX_BODY) { reject(httpErr(413, 'ข้อมูลใหญ่เกินไป')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { if (!chunks.length) return resolve({}); try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(httpErr(400, 'JSON ไม่ถูกต้อง')); } });
    req.on('error', reject);
  });
}
const need = (user, ...roles) => { if (!user) throw httpErr(401, 'กรุณาเข้าสู่ระบบ'); if (roles.length && !roles.includes(user.role)) throw httpErr(403, 'ไม่มีสิทธิ์ทำรายการนี้'); };
const str = (v, max = 200) => String(v == null ? '' : v).trim().slice(0, max);

// ---------- API ----------
async function api(req, res, url) {
  const p = url.pathname.replace(/^\/api\//, ''), m = req.method;
  if (m !== 'GET' && req.headers['x-nc'] !== '1') throw httpErr(403, 'คำขอไม่ถูกต้อง');
  const user = sessionUser(req);

  if (p === 'health' && m === 'GET') return send(res, 200, { ok: true, app: 'Next Class', db: path.basename(DB_FILE) });

  if (p === 'login' && m === 'POST') {
    if (tooMany(req.ip)) throw httpErr(429, 'พยายามเข้าสู่ระบบผิดหลายครั้ง กรุณารอ 10 นาที');
    const b = await readBody(req), role = str(b.role, 20), name = str(b.username, 120);
    const cands = db.prepare(`SELECT * FROM users WHERE active = 1 AND role = ? AND (username = ? COLLATE NOCASE OR display_name = ? OR student_id = ?) ORDER BY (username = ? COLLATE NOCASE) DESC, id`).all(role, name, name, name, name);
    let u = null;
    for (const c of cands) if (await checkPw(b.password, c.pass_hash)) { u = plain(c); break; }
    if (!u) { addFail(req.ip); audit(req, null, 'login_failed', `${role}:${name}`); throw httpErr(401, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'); }
    fails.delete(req.ip);
    const token = newSession(u.id, req.ip);
    db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(u.id);
    audit(req, u, 'login');
    return send(res, 200, { user: pubUser(u) }, { 'Set-Cookie': cookieFor(req, token, SESSION_DAYS * 86400) });
  }
  if (p === 'logout' && m === 'POST') {
    const t = cookies(req).nc_sid; if (t) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha(t));
    if (user) audit(req, user, 'logout');
    return send(res, 200, { ok: true }, { 'Set-Cookie': cookieFor(req, '', 0) });
  }
  if (p === 'me' && m === 'GET') return send(res, 200, { user: user ? pubUser(user) : null });

  if (p === 'password' && m === 'POST') {
    need(user);
    const b = await readBody(req), nw = String(b.new || '');
    if (!(await checkPw(b.old, user.pass_hash))) throw httpErr(400, 'รหัสปัจจุบันไม่ถูกต้อง');
    if (nw.length < 6) throw httpErr(400, 'รหัสใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
    if (nw === String(b.old) || nw === DEFAULT_PW || nw.toLowerCase() === 'admin') throw httpErr(400, 'รหัสใหม่ต้องไม่ซ้ำรหัสเดิมหรือรหัสเริ่มต้น');
    db.prepare('UPDATE users SET pass_hash = ?, must_change = 0 WHERE id = ?').run(await hashPw(nw), user.id);
    const t = cookies(req).nc_sid; db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?').run(user.id, sha(t || ''));
    audit(req, user, 'password_changed');
    return send(res, 200, { ok: true });
  }

  if (p === 'state' && m === 'GET') { need(user); return send(res, 200, getState(user)); }
  if (p === 'state' && m === 'DELETE') {
    need(user, 'admin');
    tx(() => { db.exec('UPDATE datasets SET active = 0; UPDATE timetables SET active = 0; DELETE FROM notes;'); });
    audit(req, user, 'data_cleared');
    return send(res, 200, { ok: true });
  }

  if (p === 'dataset' && m === 'PUT') {
    need(user, 'admin');
    const b = await readBody(req), data = b.data;
    if (!data || !Array.isArray(data.courses) || !Array.isArray(data.teachers) || !Array.isArray(data.rooms) || !Array.isArray(data.groups)) throw httpErr(400, 'ชุดข้อมูลไม่ครบ (ต้องมี courses, teachers, rooms, groups)');
    const summary = `${data.courses.length} วิชา-กลุ่ม · ${data.teachers.length} ครู · ${data.rooms.length} ห้อง · ${data.groups.length} กลุ่ม`;
    const id = tx(() => {
      db.exec('UPDATE datasets SET active = 0');
      return Number(db.prepare('INSERT INTO datasets (data_json, raw_json, summary, created_by, active) VALUES (?,?,?,?,1)').run(JSON.stringify(data), JSON.stringify(b.raw || {}), summary, user.id).lastInsertRowid);
    });
    const accounts = await syncAccounts(data);
    audit(req, user, 'dataset_saved', `#${id} ${summary} · สร้างบัญชีใหม่ ${accounts.created}`);
    return send(res, 200, { id, accounts });
  }

  if (p === 'timetable' && m === 'POST') {
    need(user, 'admin');
    const b = await readBody(req), t = b.tt, ds = activeDataset();
    if (!t || typeof t !== 'object') throw httpErr(400, 'ไม่มีข้อมูลตาราง');
    const S = slotsOf(ds), rows = cleanRows(t.rows, S), meta = { ...t }; delete meta.rows; delete meta.serverId;
    const s = summaryOf(t.m), source = t.imported ? 'import' : 'ai';
    const id = tx(() => {
      db.exec('UPDATE timetables SET active = 0');
      const tid = Number(db.prepare('INSERT INTO timetables (dataset_id, source, seed, meta_json, hard_violations, placed, total, soft_cost, created_by, active) VALUES (?,?,?,?,?,?,?,?,?,1)')
        .run(ds ? ds.id : null, source, t.seed == null ? null : String(t.seed), JSON.stringify(meta), num(s.hard), num(s.placed) ?? rows.length, num(s.total), num(s.cost), user.id).lastInsertRowid);
      putEntries(tid, rows, S);
      return tid;
    });
    audit(req, user, source === 'ai' ? 'timetable_generated' : 'timetable_imported', `#${id} seed ${t.seed ?? '-'} · ${rows.length} คาบ · Hard ${s.hard ?? '-'}`);
    return send(res, 200, { id });
  }
  if (p === 'timetable/active' && m === 'PUT') {
    need(user, 'admin', 'teacher');
    const b = await readBody(req), tt = activeTimetable();
    if (!tt) throw httpErr(404, 'ยังไม่มีตารางที่ใช้งานอยู่');
    if (b.id != null && +b.id !== tt.id) throw httpErr(409, 'มีตารางฉบับใหม่กว่าบนเซิร์ฟเวอร์ ระบบโหลดฉบับล่าสุดให้แล้ว กรุณาแก้ไขอีกครั้ง');
    const S = slotsOf(activeDataset()), rows = cleanRows(b.rows, S), s = summaryOf(b.m);
    const before = db.prepare('SELECT COUNT(*) AS n FROM timetable_entries WHERE timetable_id = ?').get(tt.id).n;
    tx(() => {
      db.prepare('DELETE FROM timetable_entries WHERE timetable_id = ?').run(tt.id);
      putEntries(tt.id, rows, S);
      db.prepare("UPDATE timetables SET updated_at = datetime('now'), placed = ?, hard_violations = COALESCE(?, hard_violations), soft_cost = COALESCE(?, soft_cost) WHERE id = ?").run(rows.length, num(s.hard), num(s.cost), tt.id);
    });
    audit(req, user, 'timetable_edited', `#${tt.id} ${before} → ${rows.length} คาบ`);
    return send(res, 200, { ok: true });
  }
  if (p === 'timetable/active' && m === 'DELETE') {
    need(user, 'admin');
    db.exec('UPDATE timetables SET active = 0');
    audit(req, user, 'timetable_cleared');
    return send(res, 200, { ok: true });
  }
  if (p === 'timetables' && m === 'GET') {
    need(user, 'admin');
    const list = db.prepare('SELECT t.id, t.source, t.seed, t.hard_violations, t.placed, t.total, t.soft_cost, t.created_at, t.updated_at, t.active, u.username AS created_by_name FROM timetables t LEFT JOIN users u ON u.id = t.created_by ORDER BY t.id DESC LIMIT 100').all().map(plain);
    return send(res, 200, { timetables: list });
  }
  let mm;
  if ((mm = p.match(/^timetables\/(\d+)\/activate$/)) && m === 'POST') {
    need(user, 'admin');
    const id = +mm[1];
    if (!db.prepare('SELECT id FROM timetables WHERE id = ?').get(id)) throw httpErr(404, 'ไม่พบตารางฉบับนี้');
    tx(() => { db.exec('UPDATE timetables SET active = 0'); db.prepare('UPDATE timetables SET active = 1 WHERE id = ?').run(id); });
    audit(req, user, 'timetable_restored', `#${id}`);
    return send(res, 200, { ok: true });
  }

  if (p === 'notes' && m === 'PUT') {
    need(user, 'admin', 'teacher');
    const b = await readBody(req), list = b.blocks;
    if (!Array.isArray(list) || list.length > 5000) throw httpErr(400, 'รูปแบบข้อความไม่ถูกต้อง');
    const old = new Map(db.prepare('SELECT id, created_at FROM notes').all().map(n => [n.id, n.created_at]));
    tx(() => {
      db.exec('DELETE FROM notes');
      const ins = db.prepare("INSERT INTO notes (id, kind, target, slots_json, note, blocking, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,COALESCE(?, datetime('now')),datetime('now'))");
      for (const x of list) {
        if (!x || !['room', 'teacher', 'group'].includes(x.kind) || !Array.isArray(x.slots)) throw httpErr(400, 'ข้อความไม่ถูกต้อง');
        const id = str(x.id, 60) || crypto.randomUUID();
        ins.run(id, x.kind, str(x.target, 120), JSON.stringify(x.slots.filter(Number.isInteger).slice(0, 200)), str(x.note, 300) || 'ไม่ว่าง', x.free ? 0 : 1, str(x.by, 120) || user.username, old.get(id) || null);
      }
    });
    audit(req, user, 'notes_saved', `${list.length} รายการ`);
    return send(res, 200, { ok: true });
  }
  if (p === 'settings/weights' && m === 'PUT') {
    need(user, 'admin');
    const b = await readBody(req);
    db.prepare("INSERT INTO settings (key, value_json, updated_at) VALUES ('weights', ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at").run(JSON.stringify(b.W ?? null));
    return send(res, 200, { ok: true });
  }

  // ----- จัดการบัญชี (แอดมิน) -----
  if (p === 'users' && m === 'GET') {
    need(user, 'admin');
    const users = db.prepare('SELECT id, username, display_name, role, teacher_name, group_name, student_id, must_change, active, created_at, last_login FROM users ORDER BY CASE role WHEN \'admin\' THEN 0 WHEN \'teacher\' THEN 1 ELSE 2 END, username').all().map(plain);
    return send(res, 200, { users });
  }
  if (p === 'users' && m === 'POST') {
    need(user, 'admin');
    const b = await readBody(req), username = str(b.username, 60), role = str(b.role, 20), pw = String(b.password || DEFAULT_PW);
    if (!username || !['admin', 'teacher', 'student'].includes(role)) throw httpErr(400, 'กรอกชื่อผู้ใช้และบทบาทให้ครบ');
    if (pw.length < 4) throw httpErr(400, 'รหัสผ่านสั้นเกินไป');
    if (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) throw httpErr(409, 'ชื่อผู้ใช้นี้มีอยู่แล้ว');
    const id = Number(db.prepare('INSERT INTO users (username, display_name, role, teacher_name, group_name, student_id, pass_hash, must_change) VALUES (?,?,?,?,?,?,?,1)')
      .run(username, str(b.display_name, 120) || username, role, str(b.teacher_name, 120) || null, str(b.group_name, 120) || null, str(b.student_id, 60) || null, await hashPw(pw)).lastInsertRowid);
    audit(req, user, 'user_created', `${username} (${role})`);
    return send(res, 200, { id });
  }
  if ((mm = p.match(/^users\/(\d+)$/)) && (m === 'PATCH' || m === 'DELETE')) {
    need(user, 'admin');
    const id = +mm[1], target = plain(db.prepare('SELECT * FROM users WHERE id = ?').get(id));
    if (!target) throw httpErr(404, 'ไม่พบบัญชี');
    const admins = () => db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1").get().n;
    if (m === 'DELETE') {
      if (id === user.id) throw httpErr(400, 'ลบบัญชีตัวเองไม่ได้');
      if (target.role === 'admin' && admins() <= 1) throw httpErr(400, 'ต้องมีแอดมินอย่างน้อย 1 บัญชี');
      db.prepare('DELETE FROM users WHERE id = ?').run(id);
      audit(req, user, 'user_deleted', target.username);
      return send(res, 200, { ok: true });
    }
    const b = await readBody(req), sets = [], vals = [];
    if (b.display_name != null) { sets.push('display_name = ?'); vals.push(str(b.display_name, 120) || target.username); }
    if (b.active != null) {
      if (!b.active && (id === user.id || (target.role === 'admin' && admins() <= 1))) throw httpErr(400, 'ปิดบัญชีนี้ไม่ได้');
      sets.push('active = ?'); vals.push(b.active ? 1 : 0);
    }
    if (b.password != null) { const pw = String(b.password || DEFAULT_PW); if (pw.length < 4) throw httpErr(400, 'รหัสผ่านสั้นเกินไป'); sets.push('pass_hash = ?', 'must_change = 1'); vals.push(await hashPw(pw)); }
    if (!sets.length) throw httpErr(400, 'ไม่มีข้อมูลที่จะแก้');
    db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
    if (b.password != null || b.active === false) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    audit(req, user, b.password != null ? 'user_password_reset' : 'user_updated', target.username);
    return send(res, 200, { ok: true });
  }

  if (p === 'audit' && m === 'GET') {
    need(user, 'admin');
    const lim = Math.min(500, Math.max(1, +url.searchParams.get('limit') || 100));
    return send(res, 200, { log: db.prepare('SELECT id, at, username, action, detail, ip FROM audit_log ORDER BY id DESC LIMIT ?').all(lim).map(plain) });
  }
  if (p === 'backup' && m === 'GET') {
    need(user, 'admin');
    audit(req, user, 'backup_downloaded');
    const all = q => db.prepare(q).all().map(plain);
    return send(res, 200, {
      app: 'Next Class', exported_at: new Date().toISOString(),
      users: all('SELECT id, username, display_name, role, teacher_name, group_name, student_id, must_change, active, created_at, last_login FROM users'),
      datasets: all('SELECT * FROM datasets'), timetables: all('SELECT * FROM timetables'), timetable_entries: all('SELECT * FROM timetable_entries'),
      notes: all('SELECT * FROM notes'), settings: all('SELECT * FROM settings'), audit_log: all('SELECT * FROM audit_log ORDER BY id DESC LIMIT 5000'),
    }, { 'Content-Disposition': 'attachment; filename="nextclass-backup.json"' });
  }
  throw httpErr(404, 'ไม่พบ API นี้');
}

// ---------- ไฟล์หน้าเว็บ ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8' };
const DENY = /^(backend|data|node_modules)(\/|$)|(^|\/)\.|\.(db|db-wal|db-shm|sqlite)$/i;
function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  if (!rel) rel = INDEX;
  const file = path.resolve(ROOT, rel);
  if (!file.startsWith(ROOT + path.sep) || DENY.test(rel.replace(/\\/g, '/'))) { res.writeHead(404); return res.end('Not found'); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('ไม่พบไฟล์'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    fs.createReadStream(file).pipe(res);
  });
}

// ---------- เริ่มเซิร์ฟเวอร์ ----------
async function main() {
  if (process.argv.includes('--reset-admin')) { await ensureAdmin(true); process.exit(0); }
  await ensureAdmin(false);
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  const server = http.createServer(async (req, res) => {
    req.ip = req.socket.remoteAddress;
    let url;
    try { url = new URL(req.url, 'http://localhost'); } catch { res.writeHead(400); return res.end(); }
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'same-origin');
    if (url.pathname.startsWith('/api/')) {
      try { await api(req, res, url); }
      catch (e) { const st = e.status || 500; if (st === 500) console.error(e); if (!res.headersSent) send(res, st, { error: st === 500 ? 'เซิร์ฟเวอร์ขัดข้อง ลองใหม่อีกครั้ง' : e.message }); }
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    serveStatic(req, res, url);
  });
  server.listen(PORT, HOST, () => {
    console.log(`Next Class พร้อมใช้งาน: http://localhost:${PORT}`);
    console.log(`ฐานข้อมูล: ${DB_FILE}`);
  });
}
main();
