import axios from 'axios';

export default async function handler(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'No authorization code received' });
  }

  try {
    // Textra's Zoho account is on the EU datacenter (crmplus.zoho.eu) - the
    // auth code was issued by accounts.zoho.eu and can only be redeemed there.
    const tokenResponse = await axios.post(
      'https://accounts.zoho.eu/oauth/v2/token',
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

    // Zoho's token endpoint returns HTTP 200 even on failure, with an
    // "error" field instead of access_token - axios won't throw for this,
    // so we have to check explicitly.
    if (tokenResponse.data.error || !tokenResponse.data.access_token) {
      console.error('Zoho token exchange failed (200 OK with error body):', tokenResponse.data);
      const errorMsg = tokenResponse.data.error || 'No access token returned';
      return res.redirect(`/dashboards#zoho_error=${encodeURIComponent(errorMsg)}`);
    }

    const { access_token, refresh_token, expires_in, api_domain } = tokenResponse.data;

    // Zoho tokens are bound to the datacenter that issued them - api_domain
    // tells us exactly which endpoint to call, so we don't have to guess.
    res.redirect(
      `/dashboards#zoho_token=${encodeURIComponent(access_token)}&zoho_refresh=${encodeURIComponent(refresh_token || '')}&zoho_expires=${expires_in}&zoho_api_domain=${encodeURIComponent(api_domain || '')}`
    );
  } catch (error) {
    console.error('Zoho OAuth error:', error.response?.data || error.message);
    console.error('Full error:', error.response);
    const errorMsg = error.response?.data?.error_description || error.response?.data?.error || error.message;
    res.redirect(`/dashboards#zoho_error=${encodeURIComponent(errorMsg)}`);
  }
}
