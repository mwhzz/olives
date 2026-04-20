const crypto = require('crypto');

function sha256(val) {
  if (!val) return null;
  return crypto.createHash('sha256').update(String(val).trim().toLowerCase()).digest('hex');
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      eventName,
      eventId,
      phone,
      fbp,
      fbc,
      sourceUrl,
      value,
      currency,
      txnId,
    } = req.body;

    const PIXEL_ID = process.env.META_PIXEL_ID;
    const TOKEN    = process.env.META_CAPI_TOKEN;

    if (!PIXEL_ID || !TOKEN) {
      return res.status(500).json({ error: 'Missing env vars' });
    }

    // Build user_data
    const userData = {
      client_ip_address: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || '',
      client_user_agent: req.headers['user-agent'] || '',
    };
    if (phone) userData.ph = [sha256(phone.replace(/[\s\-\(\)]/g, ''))];
    if (fbp)   userData.fbp = fbp;
    if (fbc)   userData.fbc = fbc;

    // Build event object
    const event = {
      event_name:       eventName,
      event_time:       Math.floor(Date.now() / 1000),
      event_id:         eventId,
      event_source_url: sourceUrl || '',
      action_source:    'website',
      user_data:        userData,
    };

    // Add custom_data for Purchase / value events
    if (value !== undefined) {
      event.custom_data = {
        value:    parseFloat(value),
        currency: currency || 'BDT',
      };
      if (txnId) event.custom_data.order_id = txnId;
    }

    const fbRes = await fetch(
      `https://graph.facebook.com/v19.0/${PIXEL_ID}/events?access_token=${TOKEN}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ data: [event] }),
      }
    );

    const result = await fbRes.json();
    return res.status(200).json({ ok: true, fb: result });

  } catch (err) {
    console.error('[CAPI Error]', err);
    return res.status(500).json({ error: err.message });
  }
};
