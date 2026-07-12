/* ================================================================
   RoadBuddy — Production Backend API
   File: backend/server.js
   ----------------------------------------------------------------
   Stack : Node.js · Express · MySQL (mysql2) · JWT · bcryptjs
   Run   : npm install && node server.js
   Deploy: Railway / Render / any Node.js host
   ================================================================

   Demo credentials (auto-seeded on first run):
     Motorist  →  maria@test.com       / password123
     Provider  →  autofix@test.com     / password123
     Admin     →  admin@roadbuddy.ph   / Admin@1234
     Invite    →  ROAD-BUDD-YADM
   ================================================================ */

require('dotenv').config();

const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const compression = require('compression');
const rateLimit   = require('express-rate-limit');
const bcrypt      = require('bcryptjs');
const jwt         = require('jsonwebtoken');
const mysql       = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
const path        = require('path');
const fs          = require('fs');

/* ── Config ── */
const PORT        = process.env.PORT        || 3001;
const NODE_ENV    = process.env.NODE_ENV    || 'development';
const JWT_SECRET  = process.env.JWT_SECRET  || 'roadbuddy-dev-secret-CHANGE-IN-PRODUCTION';
const SALT_ROUNDS = 10;
const IS_PROD     = NODE_ENV === 'production';

/* ── Express ── */
const app = express();

/* Security headers */
app.use(helmet({
  contentSecurityPolicy: false, // disabled so the frontend CDN links work
  crossOriginEmbedderPolicy: false,
}));

/* Gzip compression */
app.use(compression());

/* CORS — configurable per environment */
const rawOrigins = process.env.ALLOWED_ORIGINS || '*';
const allowedOrigins = rawOrigins === '*'
  ? '*'
  : rawOrigins.split(',').map(o => o.trim());

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET','POST','PUT','PATCH','DELETE'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

app.use(express.json({ limit: '10mb' }));

/* Rate limiting — applied only to auth routes */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { message: 'Too many requests. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/* Serve frontend from parent directory */
app.use(express.static(path.join(__dirname, '..'), {
  setHeaders(res, filePath) {
    if (filePath.endsWith('sw.js')) {
      res.setHeader('Service-Worker-Allowed', '/');
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

/* ================================================================
   DATABASE CONNECTION POOL
   Supports both DATABASE_URL and individual DB_* variables.
   ================================================================ */
let pool;

async function connectDB() {
  const config = process.env.DATABASE_URL
    ? {
        uri: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        waitForConnections: true,
        connectionLimit: 10,
      }
    : {
        host:     process.env.DB_HOST     || 'localhost',
        port:     parseInt(process.env.DB_PORT || '3306'),
        user:     process.env.DB_USER     || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME     || 'roadbuddy',
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      };

  pool = process.env.DATABASE_URL
    ? mysql.createPool(process.env.DATABASE_URL)
    : mysql.createPool(config);

  // Verify connection
  const conn = await pool.getConnection();
  console.log('✅ MySQL connected.');
  conn.release();
}

/* ── DB helpers ── */
async function dbGet(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows[0] || null;
}

async function dbAll(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function dbRun(sql, params = []) {
  const [result] = await pool.execute(sql, params);
  return result;
}

async function dbTransaction(fn) {
  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    await fn(conn);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

function now() { return Math.floor(Date.now() / 1000); }

/* ================================================================
   SCHEMA CREATION  (idempotent — safe to run on every startup)
   ================================================================ */
async function createSchema() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(36) PRIMARY KEY, email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL, role VARCHAR(20) NOT NULL DEFAULT 'motorist',
      first_name VARCHAR(100) NOT NULL, last_name VARCHAR(100) NOT NULL,
      phone VARCHAR(30), vehicle_type VARCHAR(50),
      id_photo_url TEXT, selfie_url TEXT,
      created_at BIGINT, updated_at BIGINT
    )`,
    `CREATE TABLE IF NOT EXISTS providers (
      id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) NOT NULL,
      business_name VARCHAR(255) NOT NULL, service_type VARCHAR(50) NOT NULL,
      business_address TEXT, status VARCHAR(20) NOT NULL DEFAULT 'pending',
      subscription_plan VARCHAR(20) NOT NULL DEFAULT 'trial', trial_ends_at BIGINT,
      lat DOUBLE, lng DOUBLE, avg_rating DOUBLE DEFAULT 0, review_count INT DEFAULT 0,
      created_at BIGINT
    )`,
    `CREATE TABLE IF NOT EXISTS requests (
      id VARCHAR(36) PRIMARY KEY, motorist_id VARCHAR(36), provider_id VARCHAR(36),
      service_type VARCHAR(50) NOT NULL, description TEXT,
      location_lat DOUBLE, location_lng DOUBLE, location_address TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_at BIGINT, updated_at BIGINT
    )`,
    `CREATE TABLE IF NOT EXISTS messages (
      id VARCHAR(36) PRIMARY KEY, request_id VARCHAR(36), sender_id VARCHAR(36),
      sender_role VARCHAR(20) NOT NULL, content TEXT NOT NULL,
      is_read TINYINT(1) NOT NULL DEFAULT 0, created_at BIGINT
    )`,
    `CREATE TABLE IF NOT EXISTS reviews (
      id VARCHAR(36) PRIMARY KEY, request_id VARCHAR(36),
      motorist_id VARCHAR(36), provider_id VARCHAR(36),
      rating TINYINT NOT NULL, comment TEXT,
      is_flagged TINYINT(1) NOT NULL DEFAULT 0, created_at BIGINT
    )`,
    `CREATE TABLE IF NOT EXISTS admin_users (
      id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36),
      admin_role VARCHAR(20) NOT NULL DEFAULT 'support',
      department VARCHAR(100), is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at BIGINT
    )`,
    `CREATE TABLE IF NOT EXISTS invite_codes (
      code VARCHAR(20) PRIMARY KEY, role VARCHAR(20) NOT NULL DEFAULT 'support',
      used_by VARCHAR(36), expires_at BIGINT
    )`,
    `CREATE TABLE IF NOT EXISTS audit_log (
      id VARCHAR(36) PRIMARY KEY, admin_id VARCHAR(36), admin_name VARCHAR(200),
      action VARCHAR(255) NOT NULL, target TEXT, created_at BIGINT
    )`,
    `CREATE TABLE IF NOT EXISTS settings (
      \`key\` VARCHAR(100) PRIMARY KEY, value TEXT NOT NULL, updated_at BIGINT
    )`,
  ];

  for (const sql of statements) await pool.execute(sql);
  console.log('✅ Schema ready.');
}

/* ================================================================
   SEED DATA  (runs only when users table is empty)
   ================================================================ */
async function seedIfEmpty() {
  const row = await dbGet('SELECT COUNT(*) as c FROM users');
  if (row && row.c > 0) return;

  const t     = now();
  const hashP = await bcrypt.hash('password123', SALT_ROUNDS);
  const hashA = await bcrypt.hash('Admin@1234',  SALT_ROUNDS);

  const motoristId    = uuidv4();
  const provUserId    = uuidv4();
  const adminId       = uuidv4();
  const provProfileId = uuidv4();
  const reqId         = uuidv4();

  await dbTransaction(async (conn) => {
    const run = (sql, p) => conn.execute(sql, p);

    /* Users */
    await run('INSERT INTO users VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [motoristId,'maria@test.com',hashP,'motorist','Maria','Reyes','+63-912-345-6789',null,null,null,t,t]);
    await run('INSERT INTO users VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [provUserId,'autofix@test.com',hashP,'provider','Juan','Santos','+63-998-765-4321',null,null,null,t,t]);
    await run('INSERT INTO users VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [adminId,'admin@roadbuddy.ph',hashA,'admin','System','Admin',null,null,null,null,t,t]);

    /* Primary provider */
    await run('INSERT INTO providers VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [provProfileId,provUserId,'AutoFix Repair Shop','mechanic',
       'Limketkai Center Area, Cagayan de Oro City',
       'approved','professional',t+30*86400,8.4900,124.6520,4.8,3,t]);

    /* Extra providers */
    const extras = [
      ['QuickTow Express',   'towing',   'approved','basic',        8.4680,124.6480,4.6,1],
      ['PowerStart Battery', 'battery',  'approved','professional', 8.4760,124.6620,4.9,2],
      ['TireMaster CDO',     'tire',     'approved','basic',        8.4950,124.6650,4.5,1],
      ['FuelFriend Delivery','fuel',     'approved','trial',        8.4620,124.6700,4.3,0],
      ['MechPro Services',   'mechanic', 'pending', 'trial',        8.4850,124.6350,4.7,0],
      ['RoadAssist Central', 'multi',    'approved','basic',        8.4450,124.6430,4.4,0],
      ['SpeedFix Garage',    'mechanic', 'suspended','professional',8.4780,124.6490,4.6,0],
    ];
    for (const [name,type,status,plan,lat,lng,rating,reviews] of extras) {
      const uid = uuidv4(); const pid = uuidv4();
      const fn  = name.split(' ')[0];
      await run('INSERT INTO users VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
        [uid,`${fn.toLowerCase()}@test.com`,hashP,'provider',fn,
         name.slice(fn.length).trim()||'Provider',null,null,null,null,t,t]);
      await run('INSERT INTO providers VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [pid,uid,name,type,null,status,plan,t+30*86400,lat,lng,rating,reviews,t]);
    }

    /* Seeded request */
    await run('INSERT INTO requests VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [reqId,motoristId,provProfileId,'Flat Tire','Front left tire is completely flat.',
       8.4821,124.6573,'Limketkai Dr., Brgy. Carmen, CDO','in-progress',t,t]);

    /* Messages */
    const msgs = [
      [provUserId,'provider',"Hello Maria! I received your request. I'm on my way — ETA 8 minutes.",1],
      [motoristId,'motorist',"Thank you! I'm parked on the right shoulder near the Limketkai junction.",1],
      [provUserId,'provider',"Got it! I can see your location. I'll be there shortly.",1],
      [motoristId,'motorist',"Okay, turning on my hazard lights now.",1],
      [provUserId,'provider',"Perfect. I'm 2 minutes away.",0],
    ];
    for (const [sid,role,content,read] of msgs) {
      await run('INSERT INTO messages VALUES (?,?,?,?,?,?,?)',
        [uuidv4(),reqId,sid,role,content,read,t]);
    }

    /* Reviews */
    for (const [rating,comment] of [
      [5,'Napakabilis dumating, very professional. Highly recommended!'],
      [4,'Great service, tire was fixed in under 20 minutes. Will use again.'],
      [5,'Nagulat ako sa bilis. Sobrang helpful ng messaging feature.'],
    ]) {
      await run('INSERT INTO reviews VALUES (?,?,?,?,?,?,?,?)',
        [uuidv4(),reqId,motoristId,provProfileId,rating,comment,0,t]);
    }

    /* Admin */
    await run('INSERT INTO admin_users VALUES (?,?,?,?,?,?)',
      [uuidv4(),adminId,'super','Executive',1,t]);
    await run('INSERT INTO invite_codes VALUES (?,?,?,?)',
      ['ROAD-BUDD-YADM','moderator',null,t+365*86400]);

    /* Settings */
    for (const [k,v] of [
      ['basicPrice','499'],['proPrice','1299'],['trialDays','30'],
      ['allowRegistrations','true'],['autoApproveProviders','false'],
      ['maintenanceMode','false'],['emailNotifications','true'],['smsNotifications','false'],
    ]) await run('INSERT INTO settings (`key`,value,updated_at) VALUES (?,?,?)',[k,v,t]);

    await run('INSERT INTO audit_log VALUES (?,?,?,?,?,?)',
      [uuidv4(),adminId,'System Admin','system initialized','RoadBuddy Platform',t]);
  });

  console.log('✅ Database seeded with demo data.');
}

/* ================================================================
   AUTH MIDDLEWARE
   ================================================================ */
function requireAuth(req, res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ message: 'Authentication required.' });
  try { req.user = jwt.verify(h.slice(7), JWT_SECRET); next(); }
  catch { return res.status(401).json({ message: 'Invalid or expired token.' }); }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required.' });
    next();
  });
}

/* Wrap async route handlers to forward errors to global handler */
const ar = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

async function logAudit(adminId, adminName, action, target) {
  try { await dbRun('INSERT INTO audit_log VALUES (?,?,?,?,?,?)',
    [uuidv4(),adminId,adminName,action,target,now()]); } catch {}
}

/* ================================================================
   ROUTES
   ================================================================ */

app.get('/api/health', (_, res) => res.json({ status:'ok', version:'1.0.0', phase:6, env: NODE_ENV }));

/* ── Auth ── */
app.post('/api/auth/register', authLimiter, ar(async (req, res) => {
  const { email, password, role, firstName, lastName, phone,
          vehicleType, businessName, serviceType, businessAddress } = req.body;
  if (!email || !password || !firstName || !lastName)
    return res.status(400).json({ message: 'Required fields missing.' });
  if (password.length < 8)
    return res.status(400).json({ message: 'Password must be at least 8 characters.' });
  if (await dbGet('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]))
    return res.status(409).json({ message: 'Email is already registered.' });

  const id = uuidv4(), hash = await bcrypt.hash(password, SALT_ROUNDS), t = now();
  await dbRun('INSERT INTO users VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    [id,email.toLowerCase(),hash,role||'motorist',firstName,lastName,phone||null,vehicleType||null,null,null,t,t]);

  if (role === 'provider' && businessName) {
    await dbRun('INSERT INTO providers VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [uuidv4(),id,businessName,serviceType||'mechanic',businessAddress||null,'pending','trial',t+30*86400,null,null,0,0,t]);
  }

  const token = jwt.sign({ id, email: email.toLowerCase(), role: role||'motorist' }, JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({ token, user: { id, email, role: role||'motorist', firstName, lastName } });
}));

app.post('/api/auth/login', authLimiter, ar(async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password required.' });

  const user = await dbGet('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
  if (!user || !await bcrypt.compare(password, user.password_hash))
    return res.status(401).json({ message: 'Invalid email or password.' });
  if (role && user.role !== role)
    return res.status(401).json({ message: `No ${role} account found with this email.` });
  if (user.role === 'admin')
    return res.status(401).json({ message: 'Use the admin login portal.' });

  let providerStatus = null;
  if (user.role === 'provider') {
    const p = await dbGet('SELECT status FROM providers WHERE user_id = ?', [user.id]);
    providerStatus = p?.status || 'pending';
  }

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, email: user.email, role: user.role,
    firstName: user.first_name, lastName: user.last_name, providerStatus } });
}));

app.post('/api/auth/admin/login', authLimiter, ar(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password required.' });

  const user = await dbGet('SELECT * FROM users WHERE email = ? AND role = ?', [email.toLowerCase(), 'admin']);
  if (!user || !await bcrypt.compare(password, user.password_hash))
    return res.status(401).json({ message: 'Invalid admin credentials.' });

  const admin = await dbGet('SELECT * FROM admin_users WHERE user_id = ?', [user.id]);
  if (!admin || !admin.is_active) return res.status(403).json({ message: 'Admin account not active.' });

  const token = jwt.sign(
    { id: user.id, email: user.email, role: 'admin', adminRole: admin.admin_role },
    JWT_SECRET, { expiresIn: '8h' }
  );
  res.json({ token, user: { id: user.id, email: user.email, role: 'admin',
    adminRole: admin.admin_role, firstName: user.first_name, lastName: user.last_name } });
}));

app.post('/api/auth/admin/register', authLimiter, ar(async (req, res) => {
  const { inviteCode, email, password, firstName, lastName, phone, adminRole, department } = req.body;
  const invite = await dbGet('SELECT * FROM invite_codes WHERE code = ?', [inviteCode]);
  if (!invite)        return res.status(400).json({ message: 'Invalid invitation code.' });
  if (invite.used_by) return res.status(400).json({ message: 'Invitation code already used.' });
  if (invite.expires_at && invite.expires_at < now())
    return res.status(400).json({ message: 'Invitation code has expired.' });
  if (await dbGet('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]))
    return res.status(409).json({ message: 'Email is already registered.' });

  const id = uuidv4(), hash = await bcrypt.hash(password, SALT_ROUNDS), t = now();
  await dbRun('INSERT INTO users VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    [id,email.toLowerCase(),hash,'admin',firstName,lastName,phone||null,null,null,null,t,t]);
  await dbRun('INSERT INTO admin_users VALUES (?,?,?,?,?,?)',
    [uuidv4(),id,adminRole||invite.role,department||null,0,t]);
  await dbRun('UPDATE invite_codes SET used_by = ? WHERE code = ?', [id, inviteCode]);

  res.status(201).json({ message: 'Admin account created. Awaiting super-admin approval.' });
}));

app.post('/api/admin/verify-invite', ar(async (req, res) => {
  const invite = await dbGet('SELECT * FROM invite_codes WHERE code = ?', [req.body.code]);
  if (!invite)        return res.json({ valid: false, message: 'Invalid invitation code.' });
  if (invite.used_by) return res.json({ valid: false, message: 'Code already used.' });
  if (invite.expires_at && invite.expires_at < now())
    return res.json({ valid: false, message: 'Code has expired.' });
  res.json({ valid: true, role: invite.role, message: 'Invitation code is valid.' });
}));

/* ── Users ── */
app.get('/api/users/me', requireAuth, ar(async (req, res) => {
  const user = await dbGet(
    'SELECT id,email,role,first_name,last_name,phone,vehicle_type,created_at FROM users WHERE id = ?',
    [req.user.id]);
  if (!user) return res.status(404).json({ message: 'User not found.' });
  const provider = user.role === 'provider'
    ? await dbGet('SELECT * FROM providers WHERE user_id = ?', [user.id]) : null;
  res.json({ user, provider });
}));

app.put('/api/users/me', requireAuth, ar(async (req, res) => {
  const { firstName, lastName, phone, vehicleType } = req.body;
  await dbRun('UPDATE users SET first_name=?,last_name=?,phone=?,vehicle_type=?,updated_at=? WHERE id=?',
    [firstName,lastName,phone,vehicleType,now(),req.user.id]);
  res.json({ message: 'Profile updated.' });
}));

/* ── Providers ── */
app.get('/api/providers/nearby', ar(async (req, res) => {
  const { lat, lng, type } = req.query;
  let sql = `SELECT p.*,u.first_name,u.last_name,u.phone FROM providers p
    JOIN users u ON p.user_id=u.id WHERE p.status='approved'`;
  const params = [];
  if (type && type !== 'all') { sql += ' AND p.service_type=?'; params.push(type); }

  const rows = await dbAll(sql, params);
  if (lat && lng) {
    const R = 6371;
    rows.forEach(p => {
      const dLat=(p.lat-+lat)*Math.PI/180, dLng=(p.lng-+lng)*Math.PI/180;
      const a=Math.sin(dLat/2)**2+Math.cos(+lat*Math.PI/180)*Math.cos(p.lat*Math.PI/180)*Math.sin(dLng/2)**2;
      p.distance_km=+(R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))).toFixed(2);
    });
    rows.sort((a,b)=>a.distance_km-b.distance_km);
  }
  res.json({ providers: rows });
}));

app.get('/api/providers/:id', ar(async (req, res) => {
  const p = await dbGet(
    'SELECT p.*,u.first_name,u.last_name,u.email,u.phone FROM providers p JOIN users u ON p.user_id=u.id WHERE p.id=?',
    [req.params.id]);
  if (!p) return res.status(404).json({ message: 'Provider not found.' });
  res.json({ provider: p });
}));

/* ── Requests ── */
app.post('/api/requests', requireAuth, ar(async (req, res) => {
  const { serviceType,description,locationLat,locationLng,locationAddress,providerId } = req.body;
  if (!serviceType) return res.status(400).json({ message: 'Service type is required.' });
  const id=uuidv4(), t=now();
  await dbRun('INSERT INTO requests VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    [id,req.user.id,providerId||null,serviceType,description||null,locationLat||null,locationLng||null,locationAddress||null,'pending',t,t]);
  res.status(201).json({ request: await dbGet('SELECT * FROM requests WHERE id=?',[id]) });
}));

app.get('/api/requests', requireAuth, ar(async (req, res) => {
  let rows;
  if (req.user.role==='motorist') {
    rows = await dbAll(
      'SELECT r.*,p.business_name FROM requests r LEFT JOIN providers p ON r.provider_id=p.id WHERE r.motorist_id=? ORDER BY r.created_at DESC',
      [req.user.id]);
  } else if (req.user.role==='provider') {
    const prov = await dbGet('SELECT id FROM providers WHERE user_id=?',[req.user.id]);
    rows = await dbAll(
      'SELECT r.*,u.first_name,u.last_name FROM requests r JOIN users u ON r.motorist_id=u.id WHERE r.provider_id=? ORDER BY r.created_at DESC',
      [prov?.id||'']);
  } else {
    rows = await dbAll('SELECT * FROM requests ORDER BY created_at DESC');
  }
  res.json({ requests: rows });
}));

app.get('/api/requests/:id', requireAuth, ar(async (req, res) => {
  const row = await dbGet(
    'SELECT r.*,u.first_name,u.last_name,u.phone,p.business_name FROM requests r JOIN users u ON r.motorist_id=u.id LEFT JOIN providers p ON r.provider_id=p.id WHERE r.id=?',
    [req.params.id]);
  if (!row) return res.status(404).json({ message: 'Request not found.' });
  res.json({ request: row });
}));

app.put('/api/requests/:id/status', requireAuth, ar(async (req, res) => {
  const { status } = req.body;
  if (!['pending','matched','in-progress','completed','cancelled'].includes(status))
    return res.status(400).json({ message: 'Invalid status.' });
  await dbRun('UPDATE requests SET status=?,updated_at=? WHERE id=?',[status,now(),req.params.id]);
  res.json({ message: 'Status updated.', status });
}));

/* ── Messages ── */
app.get('/api/messages/:requestId', requireAuth, ar(async (req, res) => {
  const msgs = await dbAll(
    'SELECT m.*,u.first_name,u.last_name FROM messages m JOIN users u ON m.sender_id=u.id WHERE m.request_id=? ORDER BY m.created_at ASC',
    [req.params.requestId]);
  await dbRun('UPDATE messages SET is_read=1 WHERE request_id=? AND sender_id!=?',
    [req.params.requestId,req.user.id]);
  res.json({ messages: msgs });
}));

app.post('/api/messages/:requestId', requireAuth, ar(async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ message: 'Message content required.' });
  const id=uuidv4();
  await dbRun('INSERT INTO messages VALUES (?,?,?,?,?,?,?)',
    [id,req.params.requestId,req.user.id,req.user.role,content.trim(),0,now()]);
  res.status(201).json({ message: await dbGet('SELECT * FROM messages WHERE id=?',[id]) });
}));

app.get('/api/messages/:requestId/unread', requireAuth, ar(async (req, res) => {
  const r = await dbGet(
    'SELECT COUNT(*) as c FROM messages WHERE request_id=? AND sender_id!=? AND is_read=0',
    [req.params.requestId,req.user.id]);
  res.json({ unread: r?.c||0 });
}));

/* ── Reviews ── */
app.post('/api/reviews', requireAuth, ar(async (req, res) => {
  const { requestId,providerId,rating,comment } = req.body;
  if (!providerId||!rating) return res.status(400).json({ message: 'Provider and rating required.' });
  if (rating<1||rating>5)   return res.status(400).json({ message: 'Rating must be 1-5.' });
  const id=uuidv4();
  await dbRun('INSERT INTO reviews VALUES (?,?,?,?,?,?,?,?)',
    [id,requestId||null,req.user.id,providerId,rating,comment?.trim()||null,0,now()]);
  const avg = await dbGet('SELECT AVG(rating) as a,COUNT(*) as c FROM reviews WHERE provider_id=?',[providerId]);
  await dbRun('UPDATE providers SET avg_rating=?,review_count=? WHERE id=?',
    [+(avg.a||0).toFixed(1),avg.c,providerId]);
  res.status(201).json({ review: await dbGet('SELECT * FROM reviews WHERE id=?',[id]) });
}));

app.get('/api/reviews/provider/:id', ar(async (req, res) => {
  const rows = await dbAll(
    'SELECT r.*,u.first_name,u.last_name FROM reviews r JOIN users u ON r.motorist_id=u.id WHERE r.provider_id=? ORDER BY r.created_at DESC',
    [req.params.id]);
  const avg = rows.length ? +(rows.reduce((s,r)=>s+r.rating,0)/rows.length).toFixed(1) : 0;
  res.json({ reviews:rows, average:avg, count:rows.length });
}));

/* ── Admin ── */
app.get('/api/admin/users', requireAdmin, ar(async (_,res) => {
  res.json({ users: await dbAll("SELECT id,email,role,first_name,last_name,phone,created_at FROM users WHERE role!='admin' ORDER BY created_at DESC") });
}));

app.get('/api/admin/providers', requireAdmin, ar(async (_,res) => {
  res.json({ providers: await dbAll('SELECT p.*,u.first_name,u.last_name,u.email,u.phone FROM providers p JOIN users u ON p.user_id=u.id ORDER BY p.created_at DESC') });
}));

app.post('/api/admin/providers/:id/approve', requireAdmin, ar(async (req,res) => {
  await dbRun("UPDATE providers SET status='approved' WHERE id=?",[req.params.id]);
  const p = await dbGet('SELECT business_name FROM providers WHERE id=?',[req.params.id]);
  await logAudit(req.user.id,'Admin','approved provider',p?.business_name);
  res.json({ message:'Provider approved.' });
}));

app.post('/api/admin/providers/:id/reject', requireAdmin, ar(async (req,res) => {
  await dbRun("UPDATE providers SET status='rejected' WHERE id=?",[req.params.id]);
  const p = await dbGet('SELECT business_name FROM providers WHERE id=?',[req.params.id]);
  await logAudit(req.user.id,'Admin','rejected provider',p?.business_name);
  res.json({ message:'Provider rejected.' });
}));

app.post('/api/admin/providers/:id/suspend', requireAdmin, ar(async (req,res) => {
  await dbRun("UPDATE providers SET status='suspended' WHERE id=?",[req.params.id]);
  const p = await dbGet('SELECT business_name FROM providers WHERE id=?',[req.params.id]);
  await logAudit(req.user.id,'Admin','suspended provider',p?.business_name);
  res.json({ message:'Provider suspended.' });
}));

app.get('/api/admin/requests', requireAdmin, ar(async (req,res) => {
  const { status } = req.query;
  let sql='SELECT r.*,u.first_name,u.last_name,p.business_name FROM requests r JOIN users u ON r.motorist_id=u.id LEFT JOIN providers p ON r.provider_id=p.id';
  const params=[];
  if (status) { sql+=' WHERE r.status=?'; params.push(status); }
  sql+=' ORDER BY r.created_at DESC';
  res.json({ requests: await dbAll(sql,params) });
}));

app.get('/api/admin/reviews', requireAdmin, ar(async (_,res) => {
  res.json({ reviews: await dbAll('SELECT r.*,u.first_name,u.last_name,p.business_name FROM reviews r JOIN users u ON r.motorist_id=u.id JOIN providers p ON r.provider_id=p.id ORDER BY r.created_at DESC') });
}));

app.patch('/api/admin/reviews/:id/flag', requireAdmin, ar(async (req,res) => {
  const rev = await dbGet('SELECT is_flagged FROM reviews WHERE id=?',[req.params.id]);
  if (!rev) return res.status(404).json({ message:'Review not found.' });
  const next=rev.is_flagged?0:1;
  await dbRun('UPDATE reviews SET is_flagged=? WHERE id=?',[next,req.params.id]);
  await logAudit(req.user.id,'Admin',next?'flagged review':'unflagged review',req.params.id);
  res.json({ flagged:!!next });
}));

app.get('/api/admin/analytics', requireAdmin, ar(async (_,res) => {
  res.json({
    totalUsers:     (await dbGet("SELECT COUNT(*) as c FROM users WHERE role!='admin'"))?.c||0,
    totalProviders: (await dbGet("SELECT COUNT(*) as c FROM providers WHERE status='approved'"))?.c||0,
    totalRequests:  (await dbGet('SELECT COUNT(*) as c FROM requests'))?.c||0,
    avgRating:      +((await dbGet('SELECT AVG(rating) as a FROM reviews'))?.a||0).toFixed(1),
    byStatus:       await dbAll('SELECT status,COUNT(*) as c FROM requests GROUP BY status'),
    byType:         await dbAll('SELECT service_type,COUNT(*) as c FROM requests GROUP BY service_type'),
  });
}));

app.get('/api/admin/audit-log', requireAdmin, ar(async (_,res) =>
  res.json({ log: await dbAll('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 100') })));

app.get('/api/admin/settings', requireAdmin, ar(async (_,res) => {
  const rows = await dbAll('SELECT `key`,value FROM settings');
  res.json({ settings: Object.fromEntries(rows.map(r=>[r.key,r.value])) });
}));

app.put('/api/admin/settings', requireAdmin, ar(async (req,res) => {
  const { settings } = req.body;
  await dbTransaction(async (conn) => {
    for (const [k,v] of Object.entries(settings)) {
      await conn.execute(
        'INSERT INTO settings (`key`,value,updated_at) VALUES (?,?,?) ON DUPLICATE KEY UPDATE value=?,updated_at=?',
        [k,String(v),now(),String(v),now()]);
    }
  });
  await logAudit(req.user.id,'Admin','updated settings',JSON.stringify(settings));
  res.json({ message:'Settings saved.' });
}));

app.get('/api/admin/admins', requireAdmin, ar(async (_,res) => {
  res.json({ admins: await dbAll('SELECT a.*,u.first_name,u.last_name,u.email FROM admin_users a JOIN users u ON a.user_id=u.id ORDER BY a.created_at DESC') });
}));

/* ── Catch-all: serve frontend for all non-API routes (SPA support) ── */
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
  } else {
    res.status(404).json({ message: 'API endpoint not found.' });
  }
});

/* ── Global error handler ── */
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] ERROR:`, err.message);
  if (!IS_PROD) console.error(err.stack);
  res.status(500).json({ message: IS_PROD ? 'Internal server error.' : err.message });
});

/* ================================================================
   STARTUP
   ================================================================ */
async function start() {
  try {
    await connectDB();
    await createSchema();
    await seedIfEmpty();

    app.listen(PORT, () => {
      console.log(`\n🚗 RoadBuddy API  →  http://localhost:${PORT}`);
      console.log(`   Environment  →  ${NODE_ENV}`);
      console.log(`   Health check →  http://localhost:${PORT}/api/health`);
      if (!IS_PROD) {
        console.log('\n   Demo accounts:');
        console.log('   Motorist  →  maria@test.com       / password123');
        console.log('   Provider  →  autofix@test.com     / password123');
        console.log('   Admin     →  admin@roadbuddy.ph   / Admin@1234');
        console.log('   Invite    →  ROAD-BUDD-YADM\n');
      }
    });
  } catch (err) {
    console.error('❌ Startup failed:', err.message);
    process.exit(1);
  }
}

start();
