require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const redisClient = require('./utils/redisClient');
const rateLimit = require('express-rate-limit');
const urlRoutes = require('./routes/urlRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');

const app = express();
app.use(express.json());

// ------------------- Supabase Client -------------------
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Make supabase and redis available to routes via `req` object
app.use((req, res, next) => {
  req.supabase = supabase;
  req.redisClient = redisClient;
  next();
});


// ------------------- Routes -------------------
app.use('/', urlRoutes);
app.use('/analytics', analyticsRoutes);

// ------------------- Start Server -------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
