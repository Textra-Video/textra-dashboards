import axios from 'axios';

export default async function handler(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'No authorization code received' });
  }

  try {
    // Exchange authorization code for access token
    const tokenResponse = await axios.post(
      'https://identity.xero.com/connect/token',
      {
        grant_type: 'authorization_code',
        client_id: process.env.XERO_CLIENT_ID,
        client_secret: process.env.XERO_CLIENT_SECRET,
        redirect_uri: process.env.XERO_REDIRECT_URI,
        code,
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Store tokens securely (in production: database or secure session)
    res.status(200).json({
      success: true,
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresIn: expires_in,
    });
  } catch (error) {
    console.error('Xero OAuth error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to authenticate with Xero' });
  }
}
