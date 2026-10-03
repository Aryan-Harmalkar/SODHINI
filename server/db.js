import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(path.join(dataDir, 'ecoclean.db'));

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    identifier    TEXT NOT NULL UNIQUE,          -- 10-digit mobile or lowercase email
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('citizen', 'collector')),
    aadhaar_last4 TEXT,
    points        INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS otps (
    identifier TEXT PRIMARY KEY,
    code       TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS analyses (
    id            TEXT PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    image         TEXT NOT NULL,                   -- data URL
    lat           REAL NOT NULL,
    lng           REAL NOT NULL,
    accuracy      REAL,
    description   TEXT,
    location_name TEXT,
    result        TEXT NOT NULL,                   -- JSON
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS complaints (
    id            TEXT PRIMARY KEY,                -- e.g. ECO-20261003-4F7K
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    analysis_id   TEXT NOT NULL UNIQUE REFERENCES analyses(id),
    image         TEXT NOT NULL,
    lat           REAL NOT NULL,
    lng           REAL NOT NULL,
    accuracy      REAL,
    description   TEXT,
    location_name TEXT,
    points_on_resolution INTEGER DEFAULT 50,
    category      TEXT NOT NULL,
    tags          TEXT NOT NULL,                   -- JSON
    status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
    resolved_by   INTEGER REFERENCES users(id),
    resolved_at   TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

try { db.exec('ALTER TABLE analyses ADD COLUMN location_name TEXT;'); } catch { /* exists */ }
try { db.exec('ALTER TABLE complaints ADD COLUMN location_name TEXT;'); } catch { /* exists */ }
try { db.exec('ALTER TABLE complaints ADD COLUMN points_on_resolution INTEGER;'); } catch { /* exists */ }


export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return expected.length === candidate.length && crypto.timingSafeEqual(candidate, expected);
}

export function publicUser(u) {
  return { id: u.id, name: u.name, identifier: u.identifier, role: u.role, points: u.points };
}

// ---- Demo seed data -------------------------------------------------------
function seed(name, identifier, password, role, points) {
  const exists = db.prepare('SELECT 1 FROM users WHERE identifier = ?').get(identifier);
  if (!exists) {
    db.prepare(
      'INSERT INTO users (name, identifier, password_hash, role, aadhaar_last4, points) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(name, identifier, hashPassword(password), role, '0000', points);
  }
}

seed('Aryan', 'demo@ecoclean.in', 'demo1234', 'citizen', 1250);
seed('Ravi Kumar', 'collector@ecoclean.in', 'demo1234', 'collector', 0);
// Leaderboard filler accounts (random passwords — not meant for login)
seed('Priya Sharma', 'priya@ecoclean.in', crypto.randomUUID(), 'citizen', 2140);
seed('Mohammed Imran', 'imran@ecoclean.in', crypto.randomUUID(), 'citizen', 1780);
seed('Sneha Patil', 'sneha@ecoclean.in', crypto.randomUUID(), 'citizen', 960);
seed('Karthik R', 'karthik@ecoclean.in', crypto.randomUUID(), 'citizen', 540);
