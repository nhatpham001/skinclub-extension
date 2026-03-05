// SkinClub Price Checker - Content Script
console.log('[SkinClub] Extension loaded!');

// Parse item name into components
function parseItemName(fullName) {
  // Example: "StatTrak™ AK-47 | Redline (Field-Tested)"
  // Example: "★ Karambit | Doppler (Factory New) Ruby"
  
  const result = {
    fullName: fullName,
    isStatTrak: false,
    isSouvenir: false,
    isKnife: false,
    weapon: '',
    skin: '',
    condition: '',
    phase: ''  // For Dopplers: Ruby, Sapphire, Phase 1, etc.
  };
  
  // Check for special prefixes
  result.isStatTrak = fullName.includes('StatTrak™');
  result.isSouvenir = fullName.includes('Souvenir');
  result.isKnife = fullName.includes('★');
  
  // Extract condition from parentheses: (Factory New), (Minimal Wear), etc.
  const conditionMatch = fullName.match(/\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)/);
  if (conditionMatch) {
    result.condition = conditionMatch[1];
  }
  
  // Extract phase for Dopplers (comes after condition)
  const phaseMatch = fullName.match(/\((?:Factory New|Minimal Wear)\)\s*(Phase \d|Ruby|Sapphire|Black Pearl|Emerald)/);
  if (phaseMatch) {
    result.phase = phaseMatch[1];
  }
  
  // Extract weapon and skin (split by " | ")
  const pipeIndex = fullName.indexOf(' | ');
  if (pipeIndex !== -1) {
    // Get weapon (everything before |, but remove prefixes)
    let weapon = fullName.substring(0, pipeIndex);
    weapon = weapon.replace('StatTrak™ ', '').replace('Souvenir ', '').trim();
    result.weapon = weapon;
    
    // Get skin (everything after |, but remove condition)
    let skin = fullName.substring(pipeIndex + 3);
    skin = skin.replace(/\s*\([^)]+\)/, '').trim();  // Remove (Condition)
    skin = skin.replace(/\s*(Phase \d|Ruby|Sapphire|Black Pearl|Emerald)$/, '').trim();  // Remove phase
    result.skin = skin;
  }
  
  return result;
}

function processItems() {
  const items = document.querySelectorAll('.list-item');
  let newItemsCount = 0;
  
  items.forEach((item) => {
    // Skip if we already added our price element to this item
    if (item.querySelector('.csfloat-price')) {
      return;
    }
    
    newItemsCount++;
    
    // Get item details
    const img = item.querySelector('img');
    const fullName = img ? img.alt : 'Unknown';
    
    // Parse the name into components
    const parsed = parseItemName(fullName);
    
    // Get price from page
    const priceEl = item.querySelector('.list-item__price .price');
    const price = priceEl ? priceEl.textContent.trim() : 'No price';
    
    // Log parsed info
    console.log('[SkinClub] Parsed item:', parsed);
    
    // Mark this item as processed by adding a placeholder element
    const marker = document.createElement('div');
    marker.className = 'csfloat-price';
    marker.textContent = 'Loading CSFloat...';
    marker.style.cssText = 'color: #00bcd4; font-size: 12px; margin-top: 4px;';
    
    // Add it after the price element
    const priceContainer = item.querySelector('.list-item__price');
    if (priceContainer) {
      priceContainer.appendChild(marker);
    }
  });
  
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
