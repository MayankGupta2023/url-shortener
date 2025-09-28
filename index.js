// index.js
require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const generateId = require('./utils/idGenerator');
const redisClient = require('./utils/redisClient'); // single Redis client
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');

const app = express();
app.use(express.json());

// ------------------- Rate Limiting -------------------
// app.use(
//   rateLimit({
//     store: new RedisStore({
//       sendCommand: (...args) => redisClient.sendCommand(args),
//     }),
//     windowMs: 60 * 1000, // 1 minute
//     max: 60,             // max 60 requests per IP per window
//     message: 'Too many requests, try again later.',
//   })
// );

// ------------------- Supabase Client -------------------
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ------------------- POST /shorten -------------------
app.post('/shorten', async (req, res) => {
  const { url } = req.body;

  // Validate URL
  try {
    new URL(url);
  } catch {
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

// ------------------- GET /:shortId -------------------
app.get('/:shortId', async (req, res) => {
  const { shortId } = req.params;

  try {
    // 1️⃣ Check Redis cache
    const cachedUrl = await redisClient.get(`url:${shortId}`);
    if (cachedUrl) return res.redirect(cachedUrl); // cache hit

    // 2️⃣ Fallback to Supabase
    const { data, error } = await supabase
      .from('urls')
      .select('target_url')
      .eq('short_id', shortId)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Not found' });

    // 3️⃣ Cache in Redis (TTL 1 hour)
    await redisClient.setEx(`url:${shortId}`, 3600, data.target_url);

    // 4️⃣ Async click counter
    redisClient.incr(`clicks:${shortId}`);

    res.redirect(data.target_url);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});
// without caching
// app.get('/:shortId', async (req, res) => {
//   const { shortId } = req.params;

//   try {
//     // Directly query Supabase (no Redis caching)
//     const { data, error } = await supabase
//       .from('urls')
//       .select('target_url')
//       .eq('short_id', shortId)
//       .single();

//     if (error || !data) {
//       return res.status(404).json({ error: 'Not found' });
//     }

//     // Optional: Async click counter in Redis if you still want tracking
//     redisClient.incr(`clicks:${shortId}`).catch(err => console.error(err));

//     // Redirect directly to the target URL
//     res.redirect(data.target_url);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Server error' });
//   }
// });


// ------------------- Start Server -------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
