// SkinClub Price Checker - Content Script
console.log('[SkinClub] Extension loaded!');

const BACKEND_URL = 'https://skinclub-extension.onrender.com';

// Parse item name into components
function parseItemName(fullName) {
  const stattrak = fullName.includes('StatTrak™');
  
  // Extract wear from parentheses
  const wearMatch = fullName.match(/\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)/);
  const wear = wearMatch ? wearMatch[1] : null;
  
  // Remove StatTrak™ prefix, ★ symbol, and wear suffix
  let cleanName = fullName
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

// Fetch CSFloat price from backend
async function fetchCSFloatPrice(parsed) {
  try {
    const stattrak = parsed.stattrak.toString();
    const gun_type = encodeURIComponent(parsed.gun_type);
    const name = encodeURIComponent(parsed.name);
    const wear = encodeURIComponent(parsed.wear || '');
    
    let url;
    if (parsed.wear) {
      url = `${BACKEND_URL}/api/price/${stattrak}/${gun_type}/${name}/${wear}`;
    } else {
      url = `${BACKEND_URL}/api/price/${stattrak}/${gun_type}/${name}`;
    }
    
    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[SkinClub] Error fetching price:', error);
    return null;
  }
}

async function processItems() {
  const items = document.querySelectorAll('.list-item');
  let newItemsCount = 0;
  
  for (const item of items) {
    // Skip if we already added our price element to this item
    if (item.querySelector('.csfloat-price')) {
      continue;
    }
    
    newItemsCount++;
    
    // Get item details
    const img = item.querySelector('img');
    const fullName = img ? img.alt : 'Unknown';
    
    // Parse the name into components
    const parsed = parseItemName(fullName);
    
    // Log parsed info
    console.log('[SkinClub] Parsed item:', parsed);
    
    // Create placeholder element first
    const marker = document.createElement('div');
    marker.className = 'csfloat-price';
    marker.textContent = 'Loading...';
    marker.style.cssText = 'color: #00bcd4; font-size: 12px; margin-top: 4px;';
    
    const priceContainer = item.querySelector('.list-item__price');
    if (priceContainer) {
      priceContainer.appendChild(marker);
    }
    
    // Fetch CSFloat price
    const priceData = await fetchCSFloatPrice(parsed);
    
    if (priceData && priceData.success) {
      marker.textContent = `CSFloat: $${priceData.price_usd}`;
      marker.style.color = '#4caf50';
    } else {
      marker.textContent = 'CSFloat: N/A';
      marker.style.color = '#ff9800';
    }
  }
  
  if (newItemsCount > 0) {
    console.log(`[SkinClub] Processed ${newItemsCount} new items`);
  }
}

// Watch for DOM changes
const observer = new MutationObserver((mutations) => {
  const hasNewNodes = mutations.some(mutation => mutation.addedNodes.length > 0);
  if (hasNewNodes) {
    processItems();
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Initial run after page loads
setTimeout(processItems, 2000);

console.log('[SkinClub] Watching for new items...');
