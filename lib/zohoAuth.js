import axios from 'axios';
import { getRedis } from './redis';

const ZOHO_TOKENS_KEY = 'zoho:tokens';
// Refresh a bit before actual expiry so a request never races an expiring token.
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

export async function saveZohoTokens({ accessToken, refreshToken, apiDomain, expiresIn }) {
  const redis = getRedis();
  const existing = (await redis.get(ZOHO_TOKENS_KEY)) || {};

  const record = {
    accessToken,
    // Zoho's refresh grant doesn't return a new refresh_token - keep the
    // existing one unless a fresh one was actually issued (initial connect).
    refreshToken: refreshToken || existing.refreshToken,
    apiDomain,
    expiresAt: Date.now() + expiresIn * 1000,
  };

  await redis.set(ZOHO_TOKENS_KEY, record);
  return record;
}

export async function getStoredZohoTokens() {
  const redis = getRedis();
  return redis.get(ZOHO_TOKENS_KEY);
}

export async function isZohoConnected() {
  const tokens = await getStoredZohoTokens();
  return Boolean(tokens?.refreshToken);
}

export async function clearZohoTokens() {
  const redis = getRedis();
  await redis.del(ZOHO_TOKENS_KEY);
}

async function requestRefreshedToken(refreshToken) {
  // Same EU datacenter as the initial token exchange - refresh tokens are
  // only valid at the accounts server that issued them.
  const tokenResponse = await axios.post('https://accounts.zoho.eu/oauth/v2/token', null, {
    params: {
      grant_type: 'refresh_token',
      client_id: process.env.ZOHO_CLIENT_ID,
      client_secret: process.env.ZOHO_CLIENT_SECRET,
      refresh_token: refreshToken,
    },
  });

  if (tokenResponse.data.error || !tokenResponse.data.access_token) {
    throw new Error(tokenResponse.data.error || 'Zoho refresh returned no access token');
  }

  return {
    accessToken: tokenResponse.data.access_token,
    apiDomain: tokenResponse.data.api_domain,
    expiresIn: tokenResponse.data.expires_in,
  };
}

// The one function every data-fetching endpoint should call. Returns a
// guaranteed-fresh { accessToken, apiDomain }, refreshing and persisting to
// Redis first if the stored token is expired or close to it. Throws
// 'ZOHO_NOT_CONNECTED' if nobody has ever connected Zoho yet.
export async function getValidZohoAccessToken() {
  const stored = await getStoredZohoTokens();

  if (!stored?.refreshToken) {
    throw new Error('ZOHO_NOT_CONNECTED');
  }

  if (stored.accessToken && stored.expiresAt && Date.now() < stored.expiresAt - EXPIRY_BUFFER_MS) {
    return { accessToken: stored.accessToken, apiDomain: stored.apiDomain };
  }

  const refreshed = await requestRefreshedToken(stored.refreshToken);
  const saved = await saveZohoTokens({ ...refreshed, refreshToken: stored.refreshToken });
  return { accessToken: saved.accessToken, apiDomain: saved.apiDomain };
}

// Force a refresh regardless of stored expiry - used when a request gets a
// 401 despite the cached token looking fresh (clock skew, manual revoke).
export async function forceRefreshZohoAccessToken() {
  const stored = await getStoredZohoTokens();
  if (!stored?.refreshToken) {
    throw new Error('ZOHO_NOT_CONNECTED');
  }
  const refreshed = await requestRefreshedToken(stored.refreshToken);
  const saved = await saveZohoTokens({ ...refreshed, refreshToken: stored.refreshToken });
  return { accessToken: saved.accessToken, apiDomain: saved.apiDomain };
}
