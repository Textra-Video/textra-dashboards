import axios from 'axios';
import { saveXeroTokens, fetchXeroTenant } from '../../../../lib/xeroAuth';

export default async function handler(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'No authorization code received' });
  }

  try {
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
        },
      }
    );

    if (tokenResponse.data.error || !tokenResponse.data.access_token) {
      console.error('Xero token exchange failed:', tokenResponse.data);
      const errorMsg = tokenResponse.data.error_description || tokenResponse.data.error || 'No access token returned';
      return res.redirect(`/dashboards#xero_error=${encodeURIComponent(errorMsg)}`);
    }

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Xero requires a separate call to discover which org(s) this
    // connection covers - the access token alone can't call the
    // accounting API without a tenantId.
    const { tenantId, tenantName } = await fetchXeroTenant(access_token);

    await saveXeroTokens({
      accessToken: access_token,
      refreshToken: refresh_token,
      tenantId,
      tenantName,
      expiresIn: expires_in,
    });

    res.redirect('/dashboards#xero_connected=1');
  } catch (error) {
    console.error('Xero OAuth error:', error.response?.data || error.message);
    const errorMsg = error.response?.data?.error_description || error.response?.data?.error || error.message;
    res.redirect(`/dashboards#xero_error=${encodeURIComponent(errorMsg)}`);
  }
}
