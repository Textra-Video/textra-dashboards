import axios from 'axios';
import { getValidZohoAccessToken } from '../../../lib/zohoAuth';

export default async function handler(req, res) {
  const { module } = req.body || {};

  try {
    const { accessToken, apiDomain } = await getValidZohoAccessToken();

    const url = module
      ? `${apiDomain}/crm/v2/settings/fields?module=${module}`
      : `${apiDomain}/crm/v2/settings/modules`;

    const response = await axios.get(url, {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });

    res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    if (error.message === 'ZOHO_NOT_CONNECTED') {
      return res.status(401).json({ error: 'not_connected' });
    }
    res.status(500).json({
      error: 'Failed to fetch Zoho metadata',
      details: error.response?.data || error.message,
    });
  }
}
