import { getRedis } from '../../../lib/redis';

const LOGIN_LOG_KEY = 'textra:loginLog';

export default async function handler(req, res) {
  try {
    const redis = getRedis();
    const raw = await redis.lrange(LOGIN_LOG_KEY, 0, -1);
    // Entries may come back already-parsed objects (Upstash auto-deserializes
    // JSON-looking strings) or as raw strings, depending on client version.
    const entries = raw.map((item) => (typeof item === 'string' ? JSON.parse(item) : item));
    res.status(200).json({ success: true, entries });
  } catch (error) {
    console.error('Login log read error:', error.message);
    res.status(500).json({ error: 'Failed to fetch login log' });
  }
}
