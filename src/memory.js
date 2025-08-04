const fs = require('fs');
const path = require('path');

// Use data directory in Docker, fallback to project root
const DATA_DIR = process.env.NODE_ENV === 'production' ? '/app/data' : path.join(__dirname, '..');
const MEMORY_FILE = path.join(DATA_DIR, 'categorization_memory.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Load categorization memory from persistent storage
 * @returns {Object} Memory object mapping payees to categories
 */
function loadMemory() {
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      const data = fs.readFileSync(MEMORY_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.warn('Warning: failed to load categorization memory:', error.message);
  }
  return {};
}

/**
 * Save categorization memory to persistent storage
 * @param {Object} memory Memory object to save
 */
function saveMemory(memory) {
  try {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
  } catch (error) {
    console.error('Error saving categorization memory:', error.message);
  }
}

/**
 * Clear all categorization memory
 */
function clearMemory() {
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      fs.unlinkSync(MEMORY_FILE);
    }
  } catch (error) {
    console.error('Error clearing categorization memory:', error.message);
  }
}

/**
 * Get memory statistics
 * @returns {Object} Stats about the current memory
 */
function getMemoryStats() {
  const memory = loadMemory();
  const entries = Object.keys(memory);
  const categories = [...new Set(Object.values(memory))];
  
  return {
    totalEntries: entries.length,
    uniqueCategories: categories.length,
    categories: categories.sort(),
    lastModified: fs.existsSync(MEMORY_FILE) 
      ? fs.statSync(MEMORY_FILE).mtime.toISOString()
      : null
  };
}

module.exports = { 
  loadMemory, 
  saveMemory, 
  clearMemory,
  getMemoryStats
};