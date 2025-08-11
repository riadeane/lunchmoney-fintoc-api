const axios = require('axios');
const { loadMemory, saveMemory } = require('./memory');

// Cached categories map keyed by lower‑case category name
let categoriesCache = null;
let memoryCache = null;

/**
 * Simple string similarity calculation (Dice coefficient)
 * @param {string} str1 First string
 * @param {string} str2 Second string
 * @returns {number} Similarity score between 0 and 1
 */
function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  const a = str1.toLowerCase();
  const b = str2.toLowerCase();
  
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  
  const aBigrams = new Set();
  for (let i = 0; i < a.length - 1; i++) {
    aBigrams.add(a.substr(i, 2));
  }
  
  const bBigrams = new Set();
  for (let i = 0; i < b.length - 1; i++) {
    bBigrams.add(b.substr(i, 2));
  }
  
  const intersection = new Set([...aBigrams].filter(x => bBigrams.has(x)));
  return (2 * intersection.size) / (aBigrams.size + bBigrams.size);
}

/**
 * Find the best matching string from a list
 * @param {string} target Target string to match
 * @param {string[]} candidates List of candidate strings
 * @returns {Object} Best match result with target and rating
 */
function findBestMatch(target, candidates) {
  let bestMatch = { target: null, rating: 0 };
  
  for (const candidate of candidates) {
    const rating = calculateSimilarity(target, candidate);
    if (rating > bestMatch.rating) {
      bestMatch = { target: candidate, rating };
    }
  }
  
  return { bestMatch };
}

/**
 * Retrieve all categories from Lunch Money and build a mapping from lower‑case
 * category name to ID.  The result is cached for subsequent calls.
 *
 * @param {string} token Lunch Money API token.
 * @returns {Promise<Object<string, number>>}
 */
async function getCategoriesMap(token) {
  if (categoriesCache) {
    return categoriesCache;
  }
  try {
    const response = await axios.get('https://dev.lunchmoney.app/v1/categories', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    const categories = response.data.categories || response.data || [];
    const map = {};
    if (Array.isArray(categories)) {
      for (const cat of categories) {
        if (cat.name && cat.id != null) {
          map[cat.name.toLowerCase()] = cat.id;
        }
      }
    }
    categoriesCache = map;
    return categoriesCache;
  } catch (err) {
    throw new Error(`Failed to fetch categories: ${err.response?.data?.error || err.message}`);
  }
}

/**
 * Get category ID by name
 * @param {string} token Lunch Money API token
 * @param {string} categoryName Category name to look up
 * @returns {Promise<number|null>} Category ID or null if not found
 */
async function getCategoryId(token, categoryName) {
  if (!categoryName) return null;
  const categories = await getCategoriesMap(token);
  return categories[categoryName.toLowerCase()] || null;
}

/**
 * Sanitize payee string for safe storage and comparison
 * @param {string} payee Raw payee string
 * @returns {string} Sanitized payee string
 */
function sanitizePayee(payee) {
  if (!payee) return '';
  return payee
    .replace(/[<>\"'/\\]/g, '') // Remove potentially dangerous characters
    .trim()
    .substring(0, 255); // Limit length
}

/**
 * Enhanced category assignment with fuzzy matching and learning
 *
 * @param {string} token Lunch Money API token.
 * @param {string} payee Payee or description from the transaction source.
 * @param {Object<string,string>} categoryRules Mapping of search strings to category names.
 * @returns {Promise<number|null>} Category ID or null if no match found.
 */
async function assignCategoryId(token, payee, categoryRules = {}) {
  if (!payee) return null;
  
  const sanitizedPayee = sanitizePayee(payee);
  if (!sanitizedPayee) return null;
  
  // Load memory once per sync session
  if (!memoryCache) {
    memoryCache = loadMemory();
  }
  
  let categoryName = null;
  let matchSource = null;
  
  // 1. Exact config rule match (highest priority)
  const lowerPayee = sanitizedPayee.toLowerCase();
  for (const [match, category] of Object.entries(categoryRules)) {
    if (lowerPayee.includes(match.toLowerCase())) {
      categoryName = category;
      matchSource = 'config_rule';
      break;
    }
  }
  
  // 2. Exact memory match
  if (!categoryName) {
    for (const [memorizedPayee, category] of Object.entries(memoryCache)) {
      if (lowerPayee.includes(memorizedPayee.toLowerCase())) {
        categoryName = category;
        matchSource = 'memory_exact';
        break;
      }
    }
  }
  
  // 3. Fuzzy memory match (70% similarity threshold)
  if (!categoryName && Object.keys(memoryCache).length > 0) {
    const memorizedPayees = Object.keys(memoryCache);
    const match = findBestMatch(sanitizedPayee, memorizedPayees);
    
    if (match.bestMatch.rating >= 0.7) {
      categoryName = memoryCache[match.bestMatch.target];
      matchSource = `memory_fuzzy_${Math.round(match.bestMatch.rating * 100)}%`;
    }
  }
  
  // 4. Save successful match to memory (except config rules)
  if (categoryName && matchSource !== 'config_rule') {
    const existingEntry = memoryCache[sanitizedPayee];
    if (!existingEntry || existingEntry !== categoryName) {
      memoryCache[sanitizedPayee] = categoryName;
      saveMemory(memoryCache);
      console.log(`🧠 Learned: "${sanitizedPayee}" → "${categoryName}" (${matchSource})`);
    }
  }
  
  // 5. Look up category ID
  if (categoryName) {
    try {
      const categoryId = await getCategoryId(token, categoryName);
      if (categoryId) {
        return categoryId;
      } else {
        console.warn(`Warning: Category "${categoryName}" not found in Lunch Money`);
      }
    } catch (err) {
      console.error(`Error looking up category "${categoryName}":`, err.message);
    }
  }
  
  return null;
}

module.exports = {
  getCategoriesMap,
  assignCategoryId
};