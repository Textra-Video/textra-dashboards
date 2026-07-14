import axios from 'axios';
import { saveZohoTokens } from '../../../../lib/zohoAuth';

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

    if (!refresh_token) {
      console.error('Zoho token exchange succeeded but returned no refresh_token - shared auto-refresh will not work.');
    }

    // Store the token server-side (shared Redis) instead of handing it to
    // the browser - any user who logs into the dashboard now shares this
    // one Zoho connection instead of each device needing its own.
    await saveZohoTokens({
      accessToken: access_token,
      refreshToken: refresh_token,
      apiDomain: api_domain,
      expiresIn: expires_in,
    });

    res.redirect('/dashboards#zoho_connected=1');
  } catch (error) {
    console.error('Zoho OAuth error:', error.response?.data || error.message);
    console.error('Full error:', error.response);
    const errorMsg = error.response?.data?.error_description || error.response?.data?.error || error.message;
    res.redirect(`/dashboards#zoho_error=${encodeURIComponent(errorMsg)}`);
  }
}
