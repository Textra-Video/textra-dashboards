import { Redis } from '@upstash/redis';

// The Vercel Marketplace Upstash integration injects KV_REST_API_URL /
// KV_REST_API_TOKEN (legacy @vercel/kv naming), not the UPSTASH_REDIS_REST_*
// names Redis.fromEnv() looks for by default - so construct explicitly.
let client = null;

export function getRedis() {
  if (!client) {
    client = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
  }
  return client;
}
