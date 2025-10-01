// routes/urlRoutes.js
const express = require('express');
const router = express.Router();
const generateId = require('../utils/idGenerator');
const geoip = require('geoip-lite');
const rateLimit = require('express-rate-limit');

// ------------------- POST /shorten -------------------
router.post('/shorten', async (req, res) => {
  const { url } = req.body;
  const { supabase, redisClient } = req;

  // Validate URL
  try { new URL(url); } 
  catch {
    await logSecurityEvent(supabase, null, req, { malformed_request: true });
    return res.status(400).json({ error: 'Invalid URL' });
  }

  // Generate unique short ID
  let shortId = generateId();
  let { data: existing } = await supabase
    .from('urls')
    .select('short_id')
    .eq('short_id', shortId);

  while (existing && existing.length > 0) {
    shortId = generateId();
    existing = await supabase
      .from('urls')
      .select('short_id')
      .eq('short_id', shortId);
  }

  // Insert into DB
  const { data, error } = await supabase
    .from('urls')
    .insert([{ short_id: shortId, target_url: url }]);

  if (error) return res.status(500).json({ error: error.message });

  res.json({ short_url: `${process.env.BASE_URL}/${shortId}` });
});

// ------------------- Rate Limiter -------------------
// Limit to 10 requests per IP per minute (adjust as needed)
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,             // max 10 requests per IP per window
  handler: async (req, res) => {
    // Log the blocked request as a security event
    await logSecurityEvent(req.supabase, req.params.shortId, req, { rate_limit_exceeded: true });
    return res.status(429).json({ error: 'Too many requests. Rate limit exceeded.' });
  }
});



// ------------------- GET /:shortId -------------------
router.get('/:shortId', limiter, async (req, res) => {
  const { shortId } = req.params;
  const { supabase, redisClient } = req;
  const start = Date.now();

  try {
    // 1️⃣ Check Redis cache
    const cachedUrl = await redisClient.get(`url:${shortId}`);
    const cacheHit = !!cachedUrl;

    // 2️⃣ Fallback to Supabase
    const { data, error } = cachedUrl
      ? { data: { target_url: cachedUrl }, error: null }
      : await supabase.from('urls').select('target_url').eq('short_id', shortId).single();

    // 3️⃣ Handle 404
    if (error || !data) {
      await trackAnalytics(req, shortId, cacheHit, Date.now() - start, true);
      // Log failed redirect as security event if needed
      await logSecurityEvent(supabase, shortId, req, { suspicious_activity: true });
      return res.status(404).json({ error: 'Not found' });
    }

    // 4️⃣ Cache in Redis if not already cached
    if (!cacheHit) await redisClient.setEx(`url:${shortId}`, 3600, data.target_url);

    // 5️⃣ Track analytics asynchronously
    trackAnalytics(req, shortId, cacheHit, Date.now() - start, false).catch(err =>
      console.error(err)
    );

    // 6️⃣ Redirect
    res.redirect(data.target_url);

  } catch (err) {
    await trackAnalytics(req, shortId, false, Date.now() - start, true);
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});




// ------------------- Analytics Tracker -------------------
async function trackAnalytics(req, shortId, cacheHit, redirectLatency, failedRedirect) {
  const { supabase } = req;
  const timestamp = new Date();
  const referrer = req.get('Referrer') || null;
  const userAgent = req.get('User-Agent') || null;

  // Determine IP
  let ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
  if (ip === '::1' || ip === '127.0.0.1') ip = '8.8.8.8'; // For local testing

  // GeoIP lookup
  let country = null, city = null;
  const geo = geoip.lookup(ip);
  if (geo) {
    country = geo.country || null;
    city = geo.city || null;
  }

  const date = timestamp.toISOString().split('T')[0];
  const hour = timestamp.getHours();

  try {
    // --- 1️⃣ Aggregated daily/hourly clicks ---
    const { data: existingRows } = await supabase
      .from('url_analytics_daily')
      .select('id, clicks')
      .eq('short_id', shortId)
      .eq('date', date)
      .eq('hour', hour);

    if (existingRows && existingRows.length > 0) {
      const row = existingRows[0];
      await supabase
        .from('url_analytics_daily')
        .update({ clicks: row.clicks + 1 })
        .eq('id', row.id);
    } else {
      await supabase.from('url_analytics_daily').insert({
        short_id: shortId,
        date,
        hour,
        clicks: 1
      });
    }

    // --- 2️⃣ Raw click events ---
    await supabase.from('url_analytics_events').insert([{
      short_id: shortId,
      timestamp,
      ip,
      referrer,
      user_agent: userAgent,
      country,
      city
    }]);

    // --- 3️⃣ URL performance ---
    await supabase.from('url_performance').insert([{
      short_id: shortId,
      timestamp,
      cache_hit: cacheHit,
      redirect_latency_ms: redirectLatency,
      failed_redirect: failedRedirect
    }]);

  } catch (err) {
    console.error('Analytics tracking failed:', err);
  }
}

// ------------------- Security / Abuse Logging -------------------
async function logSecurityEvent(supabase, shortId, req, flags) {
  try {
    const timestamp = new Date();
    let ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
    const referrer = req.get('Referrer') || null;
    const userAgent = req.get('User-Agent') || null;

    await supabase.from('url_security_events').insert([{
      short_id: shortId,
      timestamp,
      ip,
      referrer,
      user_agent: userAgent,
      rate_limit_exceeded: flags.rate_limit_exceeded || false,
      suspicious_activity: flags.suspicious_activity || false,
      malformed_request: flags.malformed_request || false
    }]);
  } catch (err) {
    console.error('Security logging failed:', err);
  }
}

module.exports = router;
