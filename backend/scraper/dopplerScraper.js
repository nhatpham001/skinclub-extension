const { chromium } = require('playwright');

// Set to false to see browser window (development mode)
const HEADLESS = true;

// Knife def_index mappings
const KNIFE_IDS = {
  'Butterfly Knife': 515,
  'M9 Bayonet': 508,
  'Karambit': 507,
  'Nomad Knife': 521,
  'Flip Knife': 505,
  'Gut Knife': 506,
  'Huntsman Knife': 509,
  'Bayonet': 500,
  'Bowie Knife': 514,
  'Falchion Knife': 512,
  'Navaja Knife': 520,
  'Paracord Knife': 517,
  'Shadow Daggers': 516,
  'Skeleton Knife': 525,
  'Stiletto Knife': 522,
  'Talon Knife': 523,
  'Survival Knife': 518,
  'Ursus Knife': 519,
};

// Gamma Doppler paint_index by phase
const GAMMA_DOPPLER_PHASES = {
  'Phase 1': 569,
  'Phase 2': 570,
  'Phase 3': 571,
  'Phase 4': 572,
  // 'Emerald': ???,
};

// Regular Doppler paint_index by phase
const DOPPLER_PHASES = {
  'Phase 1': 418,
  'Phase 2': 618,
  'Phase 3': 420,
  'Phase 4': 421,
  // 'Ruby': ???,
  // 'Sapphire': ???,
  // 'Black Pearl': ???,
};

// Category: 1 = non-StatTrak, 2 = StatTrak (verify this)
const CATEGORY = {
  normal: 1,
  stattrak: 2
};

// Build the scrape queue using IDs
function buildScrapeQueue() {
  const queue = [];
  
  // For each knife we have IDs for
  for (const [knifeName, defIndex] of Object.entries(KNIFE_IDS)) {
    
    // Gamma Doppler phases
    for (const [phaseName, paintIndex] of Object.entries(GAMMA_DOPPLER_PHASES)) {
      // Non-StatTrak
      queue.push({
        knife: knifeName,
        skin: 'Gamma Doppler',
        phase: phaseName,
        def_index: defIndex,
        paint_index: paintIndex,
        category: CATEGORY.normal,
        stattrak: false
      });
      
      // StatTrak
      queue.push({
        knife: knifeName,
        skin: 'Gamma Doppler',
        phase: phaseName,
        def_index: defIndex,
        paint_index: paintIndex,
        category: CATEGORY.stattrak,
        stattrak: true
      });
    }
    
    // Regular Doppler phases (when we have the IDs)
    for (const [phaseName, paintIndex] of Object.entries(DOPPLER_PHASES)) {
      // Non-StatTrak
      queue.push({
        knife: knifeName,
        skin: 'Doppler',
        phase: phaseName,
        def_index: defIndex,
        paint_index: paintIndex,
        category: CATEGORY.normal,
        stattrak: false
      });
      
      // StatTrak
      queue.push({
        knife: knifeName,
        skin: 'Doppler',
        phase: phaseName,
        def_index: defIndex,
        paint_index: paintIndex,
        category: CATEGORY.stattrak,
        stattrak: true
      });
    }
  }
  
  return queue;
}

// Scrape a single item's price from CSFloat
async function scrapePrice(item) {
  let browser;
  try {
    browser = await chromium.launch({ headless: HEADLESS });
    const page = await browser.newPage();
    
    // Set API key header if available
    if (process.env.CSFLOAT_API_KEY) {
      await page.setExtraHTTPHeaders({
        'Authorization': process.env.CSFLOAT_API_KEY
      });
    }
    
    // Build URL with def_index, paint_index, category, sorted by lowest price
    const url = `https://csfloat.com/search?category=${item.category}&def_index=${item.def_index}&paint_index=${item.paint_index}&sort_by=lowest_price`;
    
    console.log(`[Scraper] Fetching: ${item.knife} ${item.skin} ${item.phase}`);
    console.log(`[Scraper] URL: ${url}`);
    
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    
    // Wait for price element to load
    await page.waitForSelector('.price', { timeout: 15000 }).catch(() => null);
    
    // Get the first (lowest) price
    const priceText = await page.$eval(
      '.price', 
      el => el.textContent.trim()
    ).catch(() => null);
    
    if (priceText) {
      // Parse price (remove $ and convert to cents)
      const priceMatch = priceText.match(/[\d,]+\.?\d*/);
      if (priceMatch) {
        const price = parseFloat(priceMatch[0].replace(/,/g, '')) * 100;
        console.log(`[Scraper] Found price: $${(price/100).toFixed(2)}`);
        return { success: true, price: Math.round(price) };
      }
    }
    
    console.log('[Scraper] No price found');
    return { success: false, price: null };
    
  } catch (error) {
    console.error('[Scraper] Error:', error.message);
    return { success: false, error: error.message };
  } finally {
    if (browser) await browser.close();
  }
}

// Queue manager
class DopplerScraper {
  constructor(saveCallback) {
    this.queue = buildScrapeQueue();
    this.currentIndex = 0;
    this.intervalId = null;
    this.saveCallback = saveCallback; // Function to save to DB
    
    console.log(`[Scraper] Initialized with ${this.queue.length} items in queue`);
    console.log(`[Scraper] Full cycle time: ${this.queue.length * 5} seconds`);
  }
  
  // Process next item in queue
  async processNext() {
    const item = this.queue[this.currentIndex];
    
    console.log(`[Scraper] Processing ${this.currentIndex + 1}/${this.queue.length}: ${item.knife} ${item.skin} ${item.phase} ${item.stattrak ? '(ST)' : ''}`);
    
    const result = await scrapePrice(item);
    
    if (result.success && this.saveCallback) {
      await this.saveCallback({
        knife: item.knife,
        skin: item.skin,
        phase: item.phase,
        stattrak: item.stattrak,
        min_price: result.price
      });
    }
    
    // Move to next item (loop back to start)
    this.currentIndex = (this.currentIndex + 1) % this.queue.length;
  }
  
  // Start the scraper - 1 item per minute
  start() {
    if (this.intervalId) {
      console.log('[Scraper] Already running');
      return;
    }
    
    console.log('[Scraper] Starting - 1 request every 5 seconds');
    
    // Process first item immediately
    this.processNext();
    
    // Then process 1 item every minute
    this.intervalId = setInterval(
      () => this.processNext(),
      5 * 1000 // 5 seconds
    );
  }
  
  // Stop the scraper
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[Scraper] Stopped');
    }
  }
  
  // Get queue status
  getStatus() {
    return {
      total: this.queue.length,
      current: this.currentIndex,
      running: !!this.intervalId,
      currentItem: this.queue[this.currentIndex]
    };
  }
}

module.exports = { DopplerScraper, buildScrapeQueue, scrapePrice };
