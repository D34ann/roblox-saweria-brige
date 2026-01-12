const express = require('express');
const cors = require('cors');
const { createClient } = require('@vercel/postgres');

const app = express();

app.use(express.json());
app.use(cors());

// Secret key dari environment variable
const API_SECRET = process.env.API_SECRET || 'DefanCukaKoding23';

// Database client
let db;

// Initialize database connection
async function initDB() {
  if (!db) {
    db = createClient();
    await db.connect();
    
    // Create table if not exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS donations (
        id TEXT PRIMARY KEY,
        donor_name TEXT NOT NULL,
        amount INTEGER NOT NULL,
        message TEXT,
        username TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed BOOLEAN DEFAULT FALSE,
        processed_at TIMESTAMP
      )
    `);
    
    // Create index for faster queries
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_processed ON donations(processed);
      CREATE INDEX IF NOT EXISTS idx_created_at ON donations(created_at DESC);
    `);
    
    console.log('✅ Database initialized');
  }
  return db;
}

// Health check
app.get('/api', async (req, res) => {
  try {
    const db = await initDB();
    const result = await db.query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE processed = false) as pending FROM donations');
    
    res.json({ 
      status: 'Saweria to Roblox Bridge Active',
      database: 'connected',
      total_donations: parseInt(result.rows[0].total),
      pending_donations: parseInt(result.rows[0].pending),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ error: 'Database connection failed' });
  }
});

// Webhook endpoint dari Saweria
app.post('/api/webhook/saweria', async (req, res) => {
  try {
    const donation = req.body;
    
    console.log('📥 Donasi diterima:', donation);
    
    if (!donation || !donation.amount_raw) {
      return res.status(400).json({ error: 'Invalid donation data' });
    }

    const db = await initDB();

    // Extract username dari NAMA donor
    const donorName = donation.donator_name || 'Anonim';
    let extractedUsername = null;
    let cleanDonorName = donorName;
    
    // Format 1: @username
    const atMatch = donorName.match(/@([a-zA-Z0-9_]+)/);
    if (atMatch) {
      extractedUsername = atMatch[1];
      cleanDonorName = donorName.replace(/@([a-zA-Z0-9_]+)/, atMatch[1]).trim();
    }
    
    // Format 2: username langsung
    if (!extractedUsername) {
      const words = donorName.trim().split(/\s+/);
      const firstWord = words[0];
      
      if (/^[a-zA-Z0-9_]{3,20}$/.test(firstWord)) {
        extractedUsername = firstWord;
        cleanDonorName = donorName;
      }
    }
    
    // Format 3: Fallback dari message
    if (!extractedUsername) {
      const message = donation.message || '';
      const msgAtMatch = message.match(/@([a-zA-Z0-9_]+)/);
      if (msgAtMatch) {
        extractedUsername = msgAtMatch[1];
      }
    }

    const donationId = Date.now().toString() + Math.random().toString(36).substr(2, 9);

    // Save to database
    await db.query(
      `INSERT INTO donations (id, donor_name, amount, message, username, created_at, processed)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        donationId,
        cleanDonorName,
        donation.amount_raw,
        donation.message || '',
        extractedUsername,
        donation.created_at || new Date().toISOString(),
        false
      ]
    );

    console.log('✅ Donasi disimpan ke database:', {
      id: donationId,
      donor: cleanDonorName,
      amount: donation.amount_raw,
      username: extractedUsername
    });

    res.status(200).json({ 
      success: true, 
      message: 'Donation received and saved',
      donation_id: donationId,
      extracted_username: extractedUsername,
      clean_name: cleanDonorName
    });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Get pending donations (untuk Roblox)
app.get('/api/donations/pending', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  
  if (apiKey !== API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const db = await initDB();
    const result = await db.query(
      `SELECT * FROM donations WHERE processed = false ORDER BY created_at ASC LIMIT 50`
    );

    res.json({
      success: true,
      count: result.rows.length,
      donations: result.rows
    });
  } catch (error) {
    console.error('Error fetching pending:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Mark donation as processed
app.post('/api/donations/:id/processed', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  const { id } = req.params;
  
  if (apiKey !== API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const db = await initDB();
    const result = await db.query(
      `UPDATE donations SET processed = true, processed_at = $1 WHERE id = $2`,
      [new Date().toISOString(), id]
    );

    if (result.rowCount > 0) {
      res.json({ success: true, message: 'Donation marked as processed' });
    } else {
      res.status(404).json({ error: 'Donation not found' });
    }
  } catch (error) {
    console.error('Error marking processed:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get latest donations (with pagination)
app.get('/api/donations/latest', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  const limit = parseInt(req.query.limit) || 20;
  const offset = parseInt(req.query.offset) || 0;
  
  if (apiKey !== API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const db = await initDB();
    const result = await db.query(
      `SELECT * FROM donations ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await db.query(`SELECT COUNT(*) as total FROM donations`);

    res.json({
      success: true,
      donations: result.rows,
      pagination: {
        limit,
        offset,
        total: parseInt(countResult.rows[0].total)
      }
    });
  } catch (error) {
    console.error('Error fetching latest:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Stats endpoint
app.get('/api/donations/stats', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  
  if (apiKey !== API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const db = await initDB();
    const result = await db.query(`
      SELECT 
        COUNT(*) as total_donations,
        SUM(amount) as total_amount,
        AVG(amount) as average_amount,
        COUNT(*) FILTER (WHERE processed = true) as processed_count,
        COUNT(*) FILTER (WHERE processed = false) as pending_count
      FROM donations
    `);

    const stats = result.rows[0];

    res.json({
      success: true,
      stats: {
        total_amount: parseInt(stats.total_amount || 0),
        total_donations: parseInt(stats.total_donations || 0),
        average: Math.floor(stats.average_amount || 0),
        processed: parseInt(stats.processed_count || 0),
        pending: parseInt(stats.pending_count || 0)
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Clear old processed donations (keep last 1000)
app.post('/api/donations/cleanup', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  
  if (apiKey !== API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const db = await initDB();
    const result = await db.query(`
      DELETE FROM donations 
      WHERE id IN (
        SELECT id FROM donations 
        WHERE processed = true 
        ORDER BY created_at DESC 
        OFFSET 1000
      )
    `);

    res.json({ 
      success: true, 
      message: `Cleaned up ${result.rowCount} old donations` 
    });
  } catch (error) {
    console.error('Error cleanup:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = app;