import axios from 'axios';

export default async function handler(req, res) {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'refreshToken required' });
  }

  try {
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
      console.error('Zoho token refresh failed:', tokenResponse.data);
      return res.status(400).json({ error: tokenResponse.data.error || 'Failed to refresh token' });
    }

    const { access_token, expires_in, api_domain } = tokenResponse.data;
    res.status(200).json({ success: true, accessToken: access_token, apiDomain: api_domain, expiresIn: expires_in });
  } catch (error) {
    console.error('Zoho token refresh error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to refresh Zoho token',
      details: error.response?.data?.message || error.message,
    });
  }
}
