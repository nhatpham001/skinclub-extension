require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const Price = require('./models/Price');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('[MongoDB] Connected successfully'))
  .catch(err => console.error('[MongoDB] Connection error:', err.message));

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
let lastFetchTime = 0;

// Parse item details from market_hash_name
function parseItemName(marketHashName) {
  const stattrak = marketHashName.includes('StatTrak™');
  
  // Extract wear from parentheses
  const wearMatch = marketHashName.match(/\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)/);
  const wear = wearMatch ? wearMatch[1] : null;
  
  // Remove StatTrak™ prefix, ★ symbol, and wear suffix
  let cleanName = marketHashName
    .replace('StatTrak™ ', '')
    .replace('★ ', '')
    .replace(/\s*\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)/, '')
    .trim();
  
  // Split by " | " to get gun_type and skin name
  const pipeIndex = cleanName.indexOf(' | ');
  let gun_type = '';
  let name = '';
  
  if (pipeIndex !== -1) {
    gun_type = cleanName.substring(0, pipeIndex).trim().toLowerCase();
    name = cleanName.substring(pipeIndex + 3).trim().toLowerCase();
  } else {
    name = cleanName.toLowerCase();
  }
  
  const wearLower = wear ? wear.toLowerCase() : null;
  
  return { gun_type, name, wear: wearLower, stattrak };
}

async function fetchCSFloatPrices() {
  console.log('[CSFloat] Fetching price list...');
  
  try {
    const response = await fetch('https://csfloat.com/api/v1/listings/price-list');
    const data = await response.json();
    
    console.log(`[CSFloat] Received ${data.length} items, saving to database...`);
    
    // Bulk upsert all prices
    const bulkOps = data.map(item => {
      const parsed = parseItemName(item.market_hash_name);
      return {
        updateOne: {
          filter: { 
            gun_type: parsed.gun_type,
            name: parsed.name, 
            wear: parsed.wear, 
            stattrak: parsed.stattrak
          },
          update: {
            $set: { min_price: item.min_price }
          },
          upsert: true
        }
      };
    });
    
    await Price.bulkWrite(bulkOps);
    lastFetchTime = Date.now();
    
    console.log(`[CSFloat] Saved ${data.length} items to database`);
    return true;
  } catch (error) {
    console.error('[CSFloat] Error fetching prices:', error.message);
    return false;
  }
}

async function ensureFreshData() {
  const now = Date.now();
  if (now - lastFetchTime > CACHE_DURATION) {
    await fetchCSFloatPrices();
  }
}

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'SkinClub Price API', 
    status: 'running',
    endpoints: [
      '/api/health',
      '/api/price/:stattrak/:gun_type/:name/:wear'
    ]
  });
});

// Get price: /api/price/:stattrak/:gun_type/:name/:wear
app.get('/api/price/:stattrak/:gun_type/:name/:wear', async (req, res) => {
  await ensureFreshData();
  
  const stattrak = req.params.stattrak === 'true';
  const gun_type = decodeURIComponent(req.params.gun_type).toLowerCase();
  const name = decodeURIComponent(req.params.name).toLowerCase();
  const wear = decodeURIComponent(req.params.wear).toLowerCase();
  
  const price = await Price.findOne({ gun_type, name, wear, stattrak });
  
  if (price) {
    res.json({
      success: true,
      gun_type: price.gun_type,
      name: price.name,
      wear: price.wear,
      stattrak: price.stattrak,
      min_price: price.min_price,
      price_usd: (price.min_price / 100).toFixed(2)
    });
  } else {
    res.json({
      success: false,
      message: 'Item not found'
    });
  }
});

// Get price for items without wear
app.get('/api/price/:stattrak/:gun_type/:name', async (req, res) => {
  await ensureFreshData();
  
  const stattrak = req.params.stattrak === 'true';
  const gun_type = decodeURIComponent(req.params.gun_type).toLowerCase();
  const name = decodeURIComponent(req.params.name).toLowerCase();
  
  const price = await Price.findOne({ gun_type, name, wear: null, stattrak });
  
  if (price) {
    res.json({
      success: true,
      gun_type: price.gun_type,
      name: price.name,
      wear: price.wear,
      stattrak: price.stattrak,
      min_price: price.min_price,
      price_usd: (price.min_price / 100).toFixed(2)
    });
  } else {
    res.json({
      success: false,
      message: 'Item not found'
    });
  }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  const count = await Price.countDocuments();
  res.json({
    status: 'ok',
    cached_items: count,
    cache_age_seconds: Math.floor((Date.now() - lastFetchTime) / 1000)
  });
});

// Initial fetch on startup
mongoose.connection.once('open', () => {
  fetchCSFloatPrices();
});

app.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
});
