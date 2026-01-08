const express = require('express');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Store untuk menyimpan donasi sementara
const recentDonations = [];
const MAX_STORED_DONATIONS = 100;

// Secret key dari environment variable
const API_SECRET = process.env.API_SECRET || 'your-secret-key-here';

// Health check
app.get('/api', (req, res) => {
  res.json({ 
    status: 'Saweria to Roblox Bridge Active',
    donations_stored: recentDonations.length,
    timestamp: new Date().toISOString()
  });
});

// Webhook endpoint dari Saweria
app.post('/api/webhook/saweria', async (req, res) => {
  try {
    const donation = req.body;
    
    console.log('📥 Donasi diterima:', donation);

    if (!donation || !donation.amount_raw) {
      return res.status(400).json({ error: 'Invalid donation data' });
    }

    const donationData = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      donor_name: donation.donator_name || 'Anonim',
      amount: donation.amount_raw,
      message: donation.message || '',
      created_at: donation.created_at || new Date().toISOString(),
      processed: false
    };

    recentDonations.unshift(donationData);
    
    if (recentDonations.length > MAX_STORED_DONATIONS) {
      recentDonations.pop();
    }

    console.log('✅ Donasi disimpan:', donationData);

    res.status(200).json({ 
      success: true, 
      message: 'Donation received',
      donation_id: donationData.id
    });

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Endpoint untuk Roblox mengambil donasi pending
app.get('/api/donations/pending', (req, res) => {
  const apiKey = req.headers['x-api-key'];
  
  if (apiKey !== API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const pending = recentDonations.filter(d => !d.processed);
  
  res.json({
    success: true,
    count: pending.length,
    donations: pending
  });
});

// Mark donasi sebagai processed
app.post('/api/donations/:id/processed', (req, res) => {
  const apiKey = req.headers['x-api-key'];
  const { id } = req.params;
  
  if (apiKey !== API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const donation = recentDonations.find(d => d.id === id);
  
  if (donation) {
    donation.processed = true;
    res.json({ success: true, message: 'Donation marked as processed' });
  } else {
    res.status(404).json({ error: 'Donation not found' });
  }
});

// Get latest donations
app.get('/api/donations/latest', (req, res) => {
  const apiKey = req.headers['x-api-key'];
  const limit = parseInt(req.query.limit) || 10;
  
  if (apiKey !== API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  res.json({
    success: true,
    donations: recentDonations.slice(0, limit)
  });
});

// Stats endpoint
app.get('/api/donations/stats', (req, res) => {
  const apiKey = req.headers['x-api-key'];
  
  if (apiKey !== API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const total = recentDonations.reduce((sum, d) => sum + d.amount, 0);
  const count = recentDonations.length;

  res.json({
    success: true,
    stats: {
      total_amount: total,
      total_donations: count,
      average: count > 0 ? Math.floor(total / count) : 0
    }
  });
});

// Clear donations (admin only)
app.post('/api/donations/clear', (req, res) => {
  const apiKey = req.headers['x-api-key'];
  
  if (apiKey !== API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const count = recentDonations.length;
  recentDonations.length = 0;
  
  res.json({ 
    success: true, 
    message: `Cleared ${count} donations` 
  });
});

// Export for Vercel
module.exports = app;