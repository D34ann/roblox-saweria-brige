# Saweria to Roblox Donation Bridge

Webhook server untuk menghubungkan donasi Saweria dengan game Roblox.

## Setup

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Buat file `.env` dan isi:
   \`\`\`
   API_SECRET=your-secret-key-here
   \`\`\`

3. Deploy ke Vercel atau jalankan lokal:
   \`\`\`bash
   npm start
   \`\`\`

## Endpoints

- `GET /api` - Health check
- `POST /api/webhook/saweria` - Webhook dari Saweria
- `GET /api/donations/pending` - Get pending donations (requires API key)
- `POST /api/donations/:id/processed` - Mark donation as processed
- `GET /api/donations/latest` - Get latest donations
- `GET /api/donations/stats` - Get donation statistics

## Environment Variables

- `API_SECRET` - Secret key untuk autentikasi API