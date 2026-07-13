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
      null,
      {
        params: {
          grant_type: 'authorization_code',
          client_id: process.env.XERO_CLIENT_ID,
          client_secret: process.env.XERO_CLIENT_SECRET,
          redirect_uri: process.env.XERO_REDIRECT_URI,
          code,
        }
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Redirect back to dashboard with token in URL fragment
    res.redirect(
      `/dashboards#xero_token=${encodeURIComponent(access_token)}&xero_refresh=${encodeURIComponent(refresh_token || '')}&xero_expires=${expires_in}`
    );
  } catch (error) {
    console.error('Xero OAuth error:', error.response?.data || error.message);
    const errorMsg = error.response?.data?.error_description || error.response?.data?.error || error.message;
    res.redirect(`/dashboards#xero_error=${encodeURIComponent(errorMsg)}`);
  }
}
