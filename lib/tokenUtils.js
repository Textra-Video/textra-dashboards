import axios from 'axios';

// localStorage.getItem returns the literal string "undefined" if a bad
// value was ever written, and that string is truthy - so guard for it.
export function isValidToken(value) {
  return Boolean(value) && value !== 'undefined' && value !== 'null';
}

// Zoho access tokens expire after ~1 hour. Exchanges the stored refresh
// token for a new access token and persists it, so the user doesn't have
// to manually reconnect every time the old one expires.
export async function refreshZohoToken(refreshToken) {
  const response = await axios.post('/api/auth/zoho/refresh', { refreshToken });
  const { accessToken, apiDomain } = response.data;
  localStorage.setItem('zohoAccessToken', accessToken);
  if (apiDomain) localStorage.setItem('zohoApiDomain', apiDomain);
  return { accessToken, apiDomain };
}
