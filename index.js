// index.js
require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const generateId = require('./utils/idGenerator');

const app = express();
app.use(express.json());

// Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ✅ POST /shorten → returns shortened URL
app.post('/shorten', async (req, res) => {
  const { url } = req.body;
  
  // Basic validation
  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  // Generate unique ID
  let shortId = generateId();
  let { data: existing } = await supabase.from('urls').select('short_id').eq('short_id', shortId);
  while (existing && existing.length > 0) {
    shortId = generateId();
    existing = await supabase.from('urls').select('short_id').eq('short_id', shortId);
  }

  // Insert into DB
  const { data, error } = await supabase.from('urls').insert([{ short_id: shortId, target_url: url }]);
  if (error) return res.status(500).json({ error: error.message });

  res.json({ short_url: `${process.env.BASE_URL}/${shortId}` });
});

// ✅ GET /:short_id → redirect
app.get('/:shortId', async (req, res) => {
  const { shortId } = req.params;

  const { data, error } = await supabase.from('urls').select('target_url').eq('short_id', shortId).single();
  if (error || !data) return res.status(404).json({ error: 'Not found' });

  res.redirect(data.target_url);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

