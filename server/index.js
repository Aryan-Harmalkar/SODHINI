import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { db, hashPassword, verifyPassword, publicUser } from './db.js';
import { classify, calculatePoints, getPointsMeta, PTS_PER_RUPEE } from './classify.js';
import { reverseGeocode, searchGeocode } from './geo.js';

const app = express();
app.use(express.json({ limit: '15mb' }));

const PORT = process.env.PORT || 3001;
const CLASSIFY_DELAY_MS = 2000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

/** Returns a canonical identifier (lowercase email or 10-digit Indian mobile), or null. */
function normalizeIdentifier(raw = '') {
  const s = String(raw).trim().toLowerCase();
  if (isEmail(s)) return s;
  let digits = s.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

const fail = (res, status, error, field) => res.status(status).json({ error, field });

function createSession(userId) {
  const token = crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, userId);
  return token;
}

function auth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const user = token
    && db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?').get(token);
  if (!user) return fail(res, 401, 'Your session has expired. Please log in again.');
  req.user = user;
  req.token = token;
  next();
}

const roleName = (r) => (r === 'collector' ? 'Garbage Collector' : 'Citizen');

// ---- Auth -----------------------------------------------------------------

app.post('/api/auth/signup', (req, res) => {
  const { name, identifier, password, role } = req.body || {};
  const id = normalizeIdentifier(identifier);
  if (!String(name || '').trim()) return fail(res, 400, 'Enter your full name.', 'name');
  if (!id) return fail(res, 400, 'Enter a valid 10-digit mobile number or email.', 'identifier');
  if (!password || password.length < 6) return fail(res, 400, 'Password must be at least 6 characters.', 'password');
  if (!['citizen', 'collector'].includes(role)) return fail(res, 400, 'Choose a role.', 'role');
  if (db.prepare('SELECT 1 FROM users WHERE identifier = ?').get(id)) {
    return fail(res, 409, 'An account with this mobile/email already exists. Log in instead.', 'identifier');
  }
  const { lastInsertRowid } = db.prepare(
    'INSERT INTO users (name, identifier, password_hash, role) VALUES (?, ?, ?, ?)'
  ).run(name.trim(), id, hashPassword(password), role);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(lastInsertRowid);
  res.status(201).json({ token: createSession(user.id), user: publicUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const { identifier, password, role } = req.body || {};
  const id = normalizeIdentifier(identifier);
  if (!id) return fail(res, 400, 'Enter a valid 10-digit mobile number or email.', 'identifier');
  const user = db.prepare('SELECT * FROM users WHERE identifier = ?').get(id);
  if (!user || !verifyPassword(String(password || ''), user.password_hash)) {
    return fail(res, 401, 'Incorrect mobile/email or password.', 'password');
  }
  if (role && user.role !== role) {
    return fail(res, 403, `This account is registered as a ${roleName(user.role)}. Switch the role above.`, 'role');
  }
  res.json({ token: createSession(user.id), user: publicUser(user) });
});

app.post('/api/auth/otp/request', (req, res) => {
  const id = normalizeIdentifier(req.body?.identifier);
  if (!id) return fail(res, 400, 'Enter a valid 10-digit mobile number or email.', 'identifier');
  if (!db.prepare('SELECT 1 FROM users WHERE identifier = ?').get(id)) {
    return fail(res, 404, 'No account found. Sign up first.', 'identifier');
  }
  const code = String(crypto.randomInt(100000, 1000000));
  db.prepare('INSERT OR REPLACE INTO otps (identifier, code, expires_at) VALUES (?, ?, ?)')
    .run(id, code, Date.now() + 5 * 60 * 1000);
  // No SMS gateway in this demo — the code is returned so it can be shown in the UI.
  res.json({ sent: true, devCode: code });
});

app.post('/api/auth/otp/verify', (req, res) => {
  const { identifier, code, role } = req.body || {};
  const id = normalizeIdentifier(identifier);
  const row = id && db.prepare('SELECT * FROM otps WHERE identifier = ?').get(id);
  if (!row || row.expires_at < Date.now() || row.code !== String(code || '').trim()) {
    return fail(res, 401, 'Invalid or expired OTP.', 'otp');
  }
  const user = db.prepare('SELECT * FROM users WHERE identifier = ?').get(id);
  if (role && user.role !== role) {
    return fail(res, 403, `This account is registered as a ${roleName(user.role)}. Switch the role above.`, 'role');
  }
  db.prepare('DELETE FROM otps WHERE identifier = ?').run(id);
  res.json({ token: createSession(user.id), user: publicUser(user) });
});

app.post('/api/auth/logout', auth, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(req.token);
  res.json({ ok: true });
});

app.get('/api/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));

// ---- Geolocation --------------------------------------------------------

app.get('/api/geo/reverse', auth, async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return fail(res, 400, 'Valid lat and lng query params are required.');
  }
  const geo = await reverseGeocode(lat, lng);
  res.json(geo);
});

app.get('/api/geo/search', auth, async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ results: [] });
  const results = await searchGeocode(q);
  res.json({ results });
});

// ---- Classification & complaints -----------------------------------------

app.post('/api/classify', auth, async (req, res) => {
  const { image, lat, lng, accuracy, description, locationName } = req.body || {};
  if (typeof image !== 'string' || !image.startsWith('data:image/')) return fail(res, 400, 'A photo is required.');
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return fail(res, 400, 'Location is required.');

  // If client didn't supply a friendly location name, resolve one via reverse geocoding
  let resolvedName = typeof locationName === 'string' && locationName.trim() ? locationName.trim() : null;
  if (!resolvedName) {
    try {
      const geo = await reverseGeocode(lat, lng);
      resolvedName = geo.locality || null;
    } catch {
      resolvedName = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  }

  await sleep(CLASSIFY_DELAY_MS); // simulate model latency

  const result = classify({ image, description });
  const id = crypto.randomUUID();
  db.prepare(
    'INSERT INTO analyses (id, user_id, image, lat, lng, accuracy, description, location_name, result) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, req.user.id, image, lat, lng, Number.isFinite(accuracy) ? accuracy : null,
    String(description || '').slice(0, 1000), resolvedName, JSON.stringify(result));

  res.json({
    analysisId: id,
    ...result,
    location: {
      lat,
      lng,
      accuracy: accuracy ?? null,
      name: resolvedName,
    },
  });
});

function complaintId() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const suffix = Array.from({ length: 4 }, () => alphabet[crypto.randomInt(alphabet.length)]).join('');
  return `ECO-${ymd}-${suffix}`;
}

const toComplaint = (row) => {
  const tags = JSON.parse(row.tags);
  const pointsOnResolution = row.points_on_resolution || calculatePoints(tags);
  return {
    id: row.id,
    image: row.image,
    lat: row.lat,
    lng: row.lng,
    accuracy: row.accuracy,
    locationName: row.location_name || null,
    description: row.description,
    category: row.category,
    tags,
    pointsOnResolution,
    pointsInr: (pointsOnResolution / PTS_PER_RUPEE).toFixed(2),
    isHazardous: tags.some((t) => t.key === 'hazardous' || t.key === 'e_waste'),
    status: row.status,
    reporter: row.reporter_name,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
};

app.post('/api/complaints', auth, (req, res) => {
  const analysis = db.prepare('SELECT * FROM analyses WHERE id = ? AND user_id = ?')
    .get(String(req.body?.analysisId || ''), req.user.id);
  if (!analysis) return fail(res, 404, 'Analysis not found. Please analyze the photo again.');
  const result = JSON.parse(analysis.result);
  if (!result.isWaste) return fail(res, 400, "This photo doesn't look like waste, so it can't be filed.");
  const pointsOnResolution = calculatePoints(result.tags);

  const existing = db.prepare('SELECT id, points_on_resolution FROM complaints WHERE analysis_id = ?').get(analysis.id);
  if (existing) {
    const pts = existing.points_on_resolution || pointsOnResolution;
    return res.json({ id: existing.id, pointsOnResolution: pts, pointsInr: (pts / PTS_PER_RUPEE).toFixed(2) });
  }

  const id = complaintId();
  db.prepare(`
    INSERT INTO complaints (id, user_id, analysis_id, image, lat, lng, accuracy, description, location_name, category, tags, points_on_resolution)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user.id, analysis.id, analysis.image, analysis.lat, analysis.lng, analysis.accuracy,
    analysis.description, analysis.location_name, result.tags[0].key, JSON.stringify(result.tags), pointsOnResolution);
  res.status(201).json({ id, pointsOnResolution, pointsInr: (pointsOnResolution / PTS_PER_RUPEE).toFixed(2) });
});

app.get('/api/complaints', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT c.*, u.name AS reporter_name FROM complaints c JOIN users u ON u.id = c.user_id
    WHERE c.user_id = ? ORDER BY c.created_at DESC
  `).all(req.user.id);
  res.json({ complaints: rows.map(toComplaint) });
});

// Collectors: open complaints to pick up (only for collectors)
app.get('/api/pickups', auth, (req, res) => {
  if (req.user.role !== 'collector') return fail(res, 403, 'Pickups are only accessible to garbage collectors.');
  const rows = db.prepare(`
    SELECT c.*, u.name AS reporter_name FROM complaints c JOIN users u ON u.id = c.user_id
    WHERE c.status = 'pending' ORDER BY c.created_at ASC
  `).all();
  res.json({ complaints: rows.map(toComplaint) });
});

app.post('/api/complaints/:id/resolve', auth, (req, res) => {
  if (req.user.role !== 'collector') return fail(res, 403, 'Only garbage collectors can resolve complaints.');
  const c = db.prepare('SELECT * FROM complaints WHERE id = ?').get(req.params.id);
  if (!c) return fail(res, 404, 'Complaint not found.');
  if (c.status === 'resolved') return fail(res, 409, 'Complaint is already resolved.');
  db.exec('BEGIN');
  try {
    db.prepare("UPDATE complaints SET status = 'resolved', resolved_by = ?, resolved_at = datetime('now') WHERE id = ?")
      .run(req.user.id, c.id);
    const awardPoints = c.points_on_resolution || calculatePoints(JSON.parse(c.tags));
    db.prepare('UPDATE users SET points = points + ? WHERE id = ?').run(awardPoints, c.user_id);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  res.json({ ok: true });
});

app.get('/api/leaderboard', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.name, u.points,
      (SELECT COUNT(*) FROM complaints c WHERE c.user_id = u.id AND c.status = 'resolved') AS resolved
    FROM users u WHERE u.role = 'citizen' ORDER BY u.points DESC, u.name LIMIT 20
  `).all();
  res.json({ leaders: rows, me: req.user.id });
});

app.use('/api', (req, res) => fail(res, 404, 'Not found'));

// Serve the built client in production (`npm run build && npm start`)
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, req, res, _next) => {
  console.error(err);
  fail(res, err.status || 500, err.type === 'entity.too.large' ? 'Photo is too large.' : 'Something went wrong.');
});

app.listen(PORT, () => console.log(`EcoClean API on http://localhost:${PORT}`));
