const { google } = require('googleapis');
const chalk = require('chalk');

/**
 * Fetch Banco de Chile credit card transaction emails from Gmail and parse them.
 *
 * @param {Object} options
 * @param {string} options.clientId Google OAuth client ID
 * @param {string} options.clientSecret Google OAuth client secret
 * @param {string} options.refreshToken OAuth refresh token with Gmail scope
 * @param {string} [options.user] Gmail user ID, defaults to 'me'
 * @param {number} options.daysToSync Number of days to look back
 * @returns {Promise<Array<{date: string, amount: number, payee: string, reference: string}>>}
 */
async function fetchBancoChileEmails({ clientId, clientSecret, refreshToken, user = 'me', daysToSync }) {
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // Query Banco de Chile credit card notifications within time range
  const query = `from:bancochile.cl subject:(Tarjeta de Crédito) newer_than:${daysToSync}d`;
  const listRes = await gmail.users.messages.list({ userId: user, q: query });
  const messages = listRes.data.messages || [];
  const transactions = [];

  for (const msg of messages) {
    try {
      const full = await gmail.users.messages.get({ userId: user, id: msg.id, format: 'full' });
      const body = getMessageBody(full.data);
      const parsed = parseBancoChileEmail(body);
      if (parsed) {
        transactions.push({ ...parsed, reference: `gmail-${msg.id}` });
      }
    } catch (err) {
      // Log and continue
      console.warn(chalk.yellow(`Failed to parse Gmail message ${msg.id}: ${err.message}`));
    }
  }

  return transactions;
}

/**
 * Extract body text from Gmail API message
 */
function getMessageBody(message) {
  let data = '';
  const payload = message.payload || {};

  if (payload.parts) {
    // Prefer plain text part
    const part = payload.parts.find(p => p.mimeType === 'text/plain') || payload.parts[0];
    data = part?.body?.data || '';
  } else {
    data = payload.body?.data || '';
  }

  // Gmail encodes bodies in base64url
  const buff = Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  return buff.toString('utf8');
}

/**
 * Parse Banco de Chile credit card notification text into transaction fields
 * Attempts to match amount, merchant and date from the email body.
 * Returns null if parsing fails.
 */
function parseBancoChileEmail(text) {
  if (!text) return null;

  // Amount: first occurrence of $number
  const amountMatch = text.match(/\$(\d{1,3}(?:\.\d{3})*)/);
  const dateMatch = text.match(/(\d{2}\/\d{2}\/\d{4})/);
  const merchantMatch = text.match(/en\s+([^\n]+?)\s+el\s+\d{2}\/\d{2}\/\d{4}/i);

  if (!amountMatch || !dateMatch) {
    return null;
  }

  const amountStr = amountMatch[1].replace(/\./g, '');
  const amount = -Number(amountStr); // expenses are negative

  const [day, month, year] = dateMatch[1].split('/');
  const date = `${year}-${month}-${day}`;
  const payee = merchantMatch ? merchantMatch[1].trim() : 'Unknown';

  return { date, amount, payee };
}

module.exports = {
  fetchBancoChileEmails
};

