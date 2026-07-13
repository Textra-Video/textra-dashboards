import axios from 'axios';

export default async function handler(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'No authorization code received' });
  }

  try {
    // Zoho can have multiple datacenters - try the standard endpoint first
    // If it fails, the error will indicate the correct datacenter
    const tokenResponse = await axios.post(
      'https://accounts.zoho.com/oauth/v2/token',
      null,
      {
        params: {
          grant_type: 'authorization_code',
          client_id: process.env.ZOHO_CLIENT_ID,
          client_secret: process.env.ZOHO_CLIENT_SECRET,
          redirect_uri: process.env.ZOHO_REDIRECT_URI,
          code,
        }
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Store tokens securely (in production: database or secure session)
    // For now, return to frontend to store in localStorage
    res.status(200).json({
      success: true,
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresIn: expires_in,
    });
  } catch (error) {
    console.error('Zoho OAuth error:', error.response?.data || error.message);
    console.error('Full error:', error.response);
    res.status(500).json({
      error: 'Failed to authenticate with Zoho',
      details: error.response?.data?.error_description || error.response?.data?.error || error.message
    });
  }
}
