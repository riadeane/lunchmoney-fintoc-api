/**
 * Utility functions for the sync system
 */

/**
 * Execute a function with exponential backoff retry logic
 * @param {Function} fn Function to execute
 * @param {number} maxRetries Maximum number of retry attempts
 * @param {number} baseDelay Base delay in milliseconds
 * @param {Function} shouldRetry Function to determine if error should trigger retry
 * @returns {Promise} Result of the function or throws final error
 */
async function withRetry(fn, maxRetries = 3, baseDelay = 1000, shouldRetry = null) {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        break;
      }
      
      // Check if this error should trigger a retry
      if (shouldRetry && !shouldRetry(error)) {
        break;
      }
      
      // Calculate delay with exponential backoff and jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      
      console.warn(`Attempt ${attempt + 1} failed, retrying in ${Math.round(delay)}ms:`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Check if an HTTP error should trigger a retry
 * @param {Error} error The error to check
 * @returns {boolean} True if the error should trigger a retry
 */
function shouldRetryHttpError(error) {
  // Retry on network errors or 5xx server errors
  if (!error.response) {
    return true; // Network error
  }
  
  const status = error.response.status;
  
  // Retry on server errors (5xx) and rate limiting (429)
  if (status >= 500 || status === 429) {
    return true;
  }
  
  // Don't retry on client errors (4xx) except rate limiting
  return false;
}

/**
 * Rate limiter to avoid hitting API limits
 */
class RateLimiter {
  constructor(requestsPerSecond = 10) {
    this.requests = [];
    this.limit = requestsPerSecond;
  }
  
  /**
   * Wait for an available slot in the rate limit window
   */
  async waitForSlot() {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < 1000);
    
    if (this.requests.length >= this.limit) {
      const oldestRequest = Math.min(...this.requests);
      const waitTime = 1000 - (now - oldestRequest);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.requests.push(now);
  }
}

/**
 * Generate a unique fingerprint for a transaction
 * @param {Object} transaction Transaction object
 * @returns {string} SHA-256 hash of transaction details
 */
function generateTransactionFingerprint(transaction) {
  const crypto = require('crypto');
  const key = `${transaction.date}-${transaction.amount}-${transaction.payee}-${transaction.reference || ''}`;
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Sanitize sensitive information from error messages for logging
 * @param {Error} error Error object
 * @param {Object} context Additional context to sanitize
 * @returns {Object} Sanitized error information
 */
function sanitizeErrorForLogging(error, context = {}) {
  const sanitizedContext = { ...context };
  
  // Remove sensitive fields
  if (sanitizedContext.token) sanitizedContext.token = '[REDACTED]';
  if (sanitizedContext.apiKey) sanitizedContext.apiKey = '[REDACTED]';
  if (sanitizedContext.lunchmoneyToken) sanitizedContext.lunchmoneyToken = '[REDACTED]';
  if (sanitizedContext.fintocApiKey) sanitizedContext.fintocApiKey = '[REDACTED]';
  
  return {
    message: error.message,
    stack: error.stack,
    status: error.response?.status,
    statusText: error.response?.statusText,
    context: sanitizedContext
  };
}

/**
 * Batch an array into smaller chunks
 * @param {Array} array Array to batch
 * @param {number} batchSize Size of each batch
 * @returns {Array[]} Array of batches
 */
function batchArray(array, batchSize) {
  const batches = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
}

module.exports = {
  withRetry,
  shouldRetryHttpError,
  RateLimiter,
  generateTransactionFingerprint,
  sanitizeErrorForLogging,
  batchArray
};