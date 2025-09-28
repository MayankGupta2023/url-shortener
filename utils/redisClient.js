// utils/redisClient.js
const redis = require('redis');

const client = redis.createClient({
  url: process.env.REDIS_URL, // ✅ uses cloud Redis
});

client.on('error', (err) => console.error('Redis Client Error', err));

(async () => {
  await client.connect();
})();

module.exports = client;
