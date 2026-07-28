const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const API_KEY = process.env.API_KEY;
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD;

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      data JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
}
init();

// Endpoint the phone app sends data to
app.post('/api/report', async (req, res) => {
  const key = req.headers['x-api-key'];
  if (key !== API_KEY) return res.status(401).json({ error: 'unauthorized' });

  const { type, data } = req.body;
  if (!type || !data) return res.status(400).json({ error: 'missing fields' });

  await pool.query('INSERT INTO events (type, data) VALUES ($1, $2)', [type, data]);
  res.json({ ok: true });
});

// Endpoint the web dashboard reads from
app.get('/api/data', async (req, res) => {
  const pass = req.headers['x-dashboard-password'];
  if (pass !== DASHBOARD_PASSWORD) return res.status(401).json({ error: 'unauthorized' });

  const calls = await pool.query("SELECT * FROM events WHERE type='call' ORDER BY created_at DESC LIMIT 100");
  const sms = await pool.query("SELECT * FROM events WHERE type='sms' ORDER BY created_at DESC LIMIT 100");
  const location = await pool.query("SELECT * FROM events WHERE type='location' ORDER BY created_at DESC LIMIT 1");

  res.json({
    calls: calls.rows,
    sms: sms.rows,
    location: location.rows[0] || null
  });
});

app.get('/', (req, res) => res.send('Kid tracker backend running.'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on port ' + PORT));
