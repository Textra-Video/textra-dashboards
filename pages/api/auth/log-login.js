import { getRedis } from '../../../lib/redis';

const LOGIN_LOG_KEY = 'textra:loginLog';
const MAX_ENTRIES = 50;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user } = req.body;
  if (!user) {
    return res.status(400).json({ error: 'user required' });
  }

  try {
    const redis = getRedis();
    const entry = { user, timestamp: new Date().toISOString() };
    await redis.lpush(LOGIN_LOG_KEY, JSON.stringify(entry));
    await redis.ltrim(LOGIN_LOG_KEY, 0, MAX_ENTRIES - 1);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Login log write error:', error.message);
    res.status(500).json({ error: 'Failed to record login' });
  }
}
