// Tiny JSON-file "database". Easy to swap for SQLite later: keep these 4 functions.
const fs = require('fs');
const path = require('path');

const FILE = process.env.TROY_DB || path.join(__dirname, '..', 'data', 'paintings.json');

let cache = null;
let cacheMtime = 0;

function load() {
  try {
    const mtime = fs.statSync(FILE).mtimeMs;
    if (cache && mtime === cacheMtime) return cache; // unchanged on disk
    cache = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    cacheMtime = mtime;
  } catch {
    cache = cache || { meta: { updatedAt: null, count: 0 }, paintings: [] };
  }
  return cache;
}

// Atomic write: temp file, then rename, so a crash never corrupts the DB.
function save(db) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  db.meta = { updatedAt: new Date().toISOString(), count: db.paintings.length };
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, FILE);
  cache = db;
  cacheMtime = fs.statSync(FILE).mtimeMs;
}

function upsert(items) {
  const db = load();
  const byId = new Map(db.paintings.map((p) => [p.id, p]));
  for (const it of items) byId.set(it.id, it);
  db.paintings = [...byId.values()].sort((a, b) => a.id - b.id);
  save(db);
  return db.paintings.length;
}

const list = () => load().paintings;
const getById = (id) => load().paintings.find((p) => p.id === Number(id)) || null;
const meta = () => load().meta;

module.exports = { FILE, load, save, upsert, list, getById, meta };
