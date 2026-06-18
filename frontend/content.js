// SkinClub Price Checker - Content Script
console.log('[SkinClub] Extension loaded!');

// Set to true for local development, false for production
const USE_LOCAL = false;
const BACKEND_URL = USE_LOCAL 
  ? 'http://localhost:3000' 
  : 'https://skinclub-extension.onrender.com';

// Check if item is a Doppler/Gamma Doppler
function isDoppler(name) {
  const lowerName = name.toLowerCase();
  return lowerName.includes('doppler') || lowerName.includes('gamma doppler');
}

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
  
  // Check if it's a Doppler and extract knife name and skin type
  const isDopplerItem = isDoppler(name);
  let knife = null;
  let skin = null;
  
  if (isDopplerItem) {
    // For Dopplers, gun_type is the knife name (e.g., "butterfly knife")
    knife = gun_type;
    // Determine if Gamma Doppler or regular Doppler
    if (name.includes('gamma')) {
      skin = 'Gamma Doppler';
    } else {
      skin = 'Doppler';
    }
  }
  
  return { gun_type, name, wear: wearLower, stattrak, isDoppler: isDopplerItem, knife, skin };
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

// Fetch Doppler price from backend
async function fetchDopplerPrice(parsed, phase) {
  try {
    // Format knife name properly (e.g., "butterfly knife" -> "Butterfly Knife")
    const knife = parsed.knife.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const skin = encodeURIComponent(parsed.skin);
    const phaseEncoded = encodeURIComponent(phase);
    const stattrak = parsed.stattrak.toString();
    
    const url = `${BACKEND_URL}/api/doppler/${encodeURIComponent(knife)}/${skin}/${phaseEncoded}/${stattrak}`;
    
    console.log('[SkinClub] Fetching Doppler price:', url);
    
    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[SkinClub] Error fetching Doppler price:', error);
    return null;
  }
}

// Try to find phase from item element (look for phase text in the DOM)
function findPhaseFromElement(itemElement) {
  // Look for phase text in the item card
  const textContent = itemElement.textContent;
  
  // Check for phase patterns
  const phasePatterns = [
    /Phase\s*1/i,
    /Phase\s*2/i,
    /Phase\s*3/i,
    /Phase\s*4/i,
    /Ruby/i,
    /Sapphire/i,
    /Black\s*Pearl/i,
    /Emerald/i
  ];
  
  for (const pattern of phasePatterns) {
    const match = textContent.match(pattern);
    if (match) {
      // Normalize the phase name
      let phase = match[0];
      if (phase.toLowerCase().includes('phase')) {
        phase = 'Phase ' + phase.replace(/\D/g, '');
      }
      return phase;
    }
  }
  
  return null;
}

async function processItems() {
  // Support both exchange page (.inventory-list-item) and other pages (.list-item)
  const items = document.querySelectorAll('.list-item, .inventory-list-item');
  let newItemsCount = 0;
  
  for (const item of items) {
    // Skip if we already added our price element to this item
    if (item.querySelector('.csfloat-price')) {
      continue;
    }
    
    // Get item details from img alt
    const img = item.querySelector('img');
    const fullName = img ? img.alt : null;
    
    // Skip if no valid item name
    if (!fullName || fullName === 'Unknown') {
      continue;
    }
    
    newItemsCount++;
    
    // Parse the name into components
    const parsed = parseItemName(fullName);
    
    // Log parsed info
    console.log('[SkinClub] Parsed item:', parsed);
    
    // Create placeholder element first
    const marker = document.createElement('div');
    marker.className = 'csfloat-price';
    marker.textContent = 'Loading...';
    marker.style.cssText = 'color: #00bcd4; font-size: 12px; margin-top: 4px; text-align: center;';
    
    // Try different price container selectors for different page layouts
    let priceContainer = item.querySelector('.list-item__price');
    if (!priceContainer) {
      // Exchange page: find by data-qa attribute or use the price element
      priceContainer = item.querySelector('[data-qa="_50d2984b6e7d"]');
    }
    if (!priceContainer) {
      // Fallback: append to item itself
      priceContainer = item;
    }
    
    priceContainer.appendChild(marker);
    
    let priceData = null;
    
    // Check if it's a Doppler item
    if (parsed.isDoppler) {
      // Try to find the phase from the item element
      const phase = findPhaseFromElement(item);
      
      if (phase) {
        console.log('[SkinClub] Doppler detected:', parsed.knife, parsed.skin, phase);
        priceData = await fetchDopplerPrice(parsed, phase);
        
        if (priceData && priceData.success) {
          marker.textContent = `CSFloat: $${priceData.price_usd}`;
          marker.style.color = '#4caf50';
        } else {
          // Fall back to regular price API
          priceData = await fetchCSFloatPrice(parsed);
          if (priceData && priceData.success) {
            marker.textContent = `CSFloat: $${priceData.price_usd}`;
            marker.style.color = '#4caf50';
          } else {
            marker.textContent = 'CSFloat: N/A';
            marker.style.color = '#ff9800';
          }
        }
      } else {
        // No phase found, use regular price API
        console.log('[SkinClub] Doppler without phase, using base price');
        priceData = await fetchCSFloatPrice(parsed);
        if (priceData && priceData.success) {
          marker.textContent = `CSFloat: $${priceData.price_usd}`;
          marker.style.color = '#4caf50';
        } else {
          marker.textContent = 'CSFloat: N/A';
          marker.style.color = '#ff9800';
        }
      }
    } else {
      // Regular item - fetch from price API
      priceData = await fetchCSFloatPrice(parsed);
      
      if (priceData && priceData.success) {
        marker.textContent = `CSFloat: $${priceData.price_usd}`;
        marker.style.color = '#4caf50';
      } else {
        marker.textContent = 'CSFloat: N/A';
        marker.style.color = '#ff9800';
      }
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
