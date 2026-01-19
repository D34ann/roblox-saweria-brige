// By Defan Rizki Utomo

const express = require('express');
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());

const recentDonations = [];
const MAX_STORED_DONATIONS = 100;

const API_SECRET = process.env.API_SECRET || 'DefanCukaKoding23';

let robloxLeaderboard = {
  TopDonors: [],
  TotalRaised: 0,
  LastUpdated: null
};

app.get('/api', (req, res) => {
  res.json({ 
    status: 'Saweria to Roblox Bridge Active',
    donations_stored: recentDonations.length,
    timestamp: new Date().toISOString()
  });
});

app.post('/api/webhook/saweria', async (req, res) => {
  try {
    const donation = req.body;
    
    console.log('📥 Donasi diterima:', donation);
    
    if (!donation || !donation.amount_raw) {
      return res.status(400).json({ error: 'Invalid donation data' });
    }

    const donorName = donation.donator_name || 'Anonim';
    let extractedUsername = null;
    let cleanDonorName = donorName;
    
    const atMatch = donorName.match(/@([a-zA-Z0-9_]+)/);
    if (atMatch) {
      extractedUsername = atMatch[1];
      cleanDonorName = donorName.replace(/@([a-zA-Z0-9_]+)/, atMatch[1]).trim();
    }
    
    if (!extractedUsername) {
      const words = donorName.trim().split(/\s+/);
      const firstWord = words[0];
      
      if (/^[a-zA-Z0-9_]{3,20}$/.test(firstWord)) {
        extractedUsername = firstWord;
        cleanDonorName = donorName;
      }
    }
    
    if (!extractedUsername) {
      const message = donation.message || '';
      const msgAtMatch = message.match(/@([a-zA-Z0-9_]+)/);
      if (msgAtMatch) {
        extractedUsername = msgAtMatch[1];
      }
    }

    const donationData = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      donor_name: cleanDonorName,
      amount: donation.amount_raw,
      message: donation.message || '',
      username: extractedUsername,
      created_at: donation.created_at || new Date().toISOString(),
      processed: false
    };

    recentDonations.unshift(donationData);
    
    if (recentDonations.length > MAX_STORED_DONATIONS) {
      recentDonations.pop();
    }

    console.log('✅ Donasi disimpan:', {
      id: donationData.id,
      donor: donationData.donor_name,
      amount: donationData.amount,
      username: donationData.username,
      message: donationData.message,
      original_name: donorName
    });

    res.status(200).json({ 
      success: true, 
      message: 'Donation received',
      donation_id: donationData.id,
      extracted_username: donationData.username,
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

app.post('/api/leaderboard/sync', (req, res) => {
  const apiKey = req.headers['x-api-key'];
  
  if (apiKey !== API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { TopDonors, TotalRaised } = req.body;
  
  robloxLeaderboard = {
    TopDonors: TopDonors || [],
    TotalRaised: TotalRaised || 0,
    LastUpdated: new Date().toISOString()
  };

  console.log('📊 Leaderboard synced:', robloxLeaderboard.TopDonors.length, 'donors');
  
  res.json({ 
    success: true, 
    message: 'Leaderboard synced',
    donors_count: robloxLeaderboard.TopDonors.length
  });
});

app.get('/api/leaderboard', (req, res) => {
  const apiKey = req.headers['x-api-key'];
  
  if (apiKey !== API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  res.json({
    success: true,
    leaderboard: robloxLeaderboard
  });
});

module.exports = app;