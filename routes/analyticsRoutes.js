const express = require('express');
const router = express.Router();

// ------------------- Total Clicks -------------------
router.get('/:shortId/total', async (req, res) => {
  const { supabase } = req;
  const { shortId } = req.params;

  try {
    const { data, error } = await supabase
      .from('url_analytics_daily')
      .select('clicks')
      .eq('short_id', shortId);

    if (error) return res.status(500).json({ error: error.message });

    const totalClicks = data?.reduce((sum, row) => sum + row.clicks, 0) || 0;
    res.json({ shortId, totalClicks });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ------------------- Daily Clicks -------------------
router.get('/:shortId/daily', async (req, res) => {
  const { supabase } = req;
  const { shortId } = req.params;

  try {
    const { data, error } = await supabase
      .from('url_analytics_daily')
      .select('date, hour, clicks')
      .eq('short_id', shortId)
      .order('date', { ascending: true })
      .order('hour', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ shortId, daily: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ------------------- Raw Events -------------------
router.get('/:shortId/events', async (req, res) => {
  const { supabase } = req;
  const { shortId } = req.params;

  try {
    const { data, error } = await supabase
      .from('url_analytics_events')
      .select('*')
      .eq('short_id', shortId)
      .order('timestamp', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ shortId, events: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ------------------- Countries -------------------
router.get('/:shortId/countries', async (req, res) => {
  const { supabase } = req;
  const { shortId } = req.params;

  try {
    const { data, error } = await supabase
      .from('url_analytics_events')
      .select('country')
      .eq('short_id', shortId);

    if (error) return res.status(500).json({ error: error.message });

    const countries = {};
    data.forEach(row => {
      const c = row.country || 'Unknown';
      countries[c] = (countries[c] || 0) + 1;
    });

    res.json({ shortId, countries });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ------------------- URL Performance -------------------
router.get('/:shortId/performance', async (req, res) => {
  const { supabase } = req;
  const { shortId } = req.params;

  try {
    const { data, error } = await supabase
      .from('url_performance')
      .select('cache_hit, redirect_latency_ms, failed_redirect, timestamp')
      .eq('short_id', shortId)
      .order('timestamp', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const totalRequests = data.length;
    const cacheHits = data.filter(d => d.cache_hit).length;
    const failedRedirects = data.filter(d => d.failed_redirect).length;
    const avgRedirectLatencyMs = totalRequests > 0
      ? data.reduce((sum, d) => sum + d.redirect_latency_ms, 0) / totalRequests
      : 0;

    res.json({
      shortId,
      totalRequests,
      cacheHits,
      cacheHitRate: totalRequests ? (cacheHits / totalRequests) * 100 : 0,
      failedRedirects,
      avgRedirectLatencyMs
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ------------------- Security / Abuse -------------------
router.get('/:shortId/security', async (req, res) => {
  const { supabase } = req;
  const { shortId } = req.params;

  try {
    const { data, error } = await supabase
      .from('url_security_events')
      .select('rate_limit_exceeded, suspicious_activity, malformed_request, timestamp')
      .eq('short_id', shortId)
      .order('timestamp', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const totalRequests = data.length;
    const rateLimited = data.filter(d => d.rate_limit_exceeded).length;
    const suspicious = data.filter(d => d.suspicious_activity).length;
    const malformed = data.filter(d => d.malformed_request).length;

    res.json({
      shortId,
      totalRequests,
      rateLimited,
      suspicious,
      malformed
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
