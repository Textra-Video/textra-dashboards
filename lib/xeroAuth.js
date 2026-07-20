import axios from 'axios';
import { getRedis } from './redis';

const XERO_TOKENS_KEY = 'xero:tokens';
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

export async function saveXeroTokens({ accessToken, refreshToken, tenantId, tenantName, expiresIn }) {
  const redis = getRedis();
  const existing = (await redis.get(XERO_TOKENS_KEY)) || {};

  const record = {
    accessToken,
    // Unlike Zoho, Xero rotates the refresh token on every use - the old
    // one is invalidated, so we must always store whatever came back last.
    refreshToken: refreshToken || existing.refreshToken,
    tenantId: tenantId || existing.tenantId,
    tenantName: tenantName || existing.tenantName,
    expiresAt: Date.now() + expiresIn * 1000,
  };

  await redis.set(XERO_TOKENS_KEY, record);
  return record;
}

export async function getStoredXeroTokens() {
  const redis = getRedis();
  return redis.get(XERO_TOKENS_KEY);
}

export async function isXeroConnected() {
  const tokens = await getStoredXeroTokens();
  return Boolean(tokens?.refreshToken && tokens?.tenantId);
}

export async function clearXeroTokens() {
  const redis = getRedis();
  await redis.del(XERO_TOKENS_KEY);
}

// Xero requires a separate call after token exchange to discover which
// org(s) ("tenants") this connection has access to - the access token
// alone isn't enough to call the accounting API, every request also needs
// a Xero-tenant-id header.
export async function fetchXeroTenant(accessToken) {
  const response = await axios.get('https://api.xero.com/connections', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const connections = response.data || [];
  if (!connections.length) {
    throw new Error('No Xero organisations connected to this authorization.');
  }
  // Single-org setup for now - use the first connection.
  return { tenantId: connections[0].tenantId, tenantName: connections[0].tenantName };
}

async function requestRefreshedToken(refreshToken) {
  const tokenResponse = await axios.post(
    'https://identity.xero.com/connect/token',
    new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.XERO_CLIENT_ID,
      client_secret: process.env.XERO_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }
  );

  if (tokenResponse.data.error || !tokenResponse.data.access_token) {
    throw new Error(tokenResponse.data.error || 'Xero refresh returned no access token');
  }

  return {
    accessToken: tokenResponse.data.access_token,
    refreshToken: tokenResponse.data.refresh_token,
    expiresIn: tokenResponse.data.expires_in,
  };
}

// Single entry point every Xero data endpoint should call. Returns a
// guaranteed-fresh { accessToken, tenantId }, refreshing and persisting to
// Redis first if the stored token is expired or close to it.
export async function getValidXeroAccessToken() {
  const stored = await getStoredXeroTokens();

  if (!stored?.refreshToken || !stored?.tenantId) {
    throw new Error('XERO_NOT_CONNECTED');
  }

  if (stored.accessToken && stored.expiresAt && Date.now() < stored.expiresAt - EXPIRY_BUFFER_MS) {
    return { accessToken: stored.accessToken, tenantId: stored.tenantId };
  }

  const refreshed = await requestRefreshedToken(stored.refreshToken);
  const saved = await saveXeroTokens({ ...refreshed, tenantId: stored.tenantId, tenantName: stored.tenantName });
  return { accessToken: saved.accessToken, tenantId: saved.tenantId };
}

export async function forceRefreshXeroAccessToken() {
  const stored = await getStoredXeroTokens();
  if (!stored?.refreshToken || !stored?.tenantId) {
    throw new Error('XERO_NOT_CONNECTED');
  }
  const refreshed = await requestRefreshedToken(stored.refreshToken);
  const saved = await saveXeroTokens({ ...refreshed, tenantId: stored.tenantId, tenantName: stored.tenantName });
  return { accessToken: saved.accessToken, tenantId: saved.tenantId };
}
