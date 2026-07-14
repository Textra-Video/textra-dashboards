import axios from 'axios';
import { getValidZohoAccessToken } from '../../../lib/zohoAuth';

export default async function handler(req, res) {
  const { module, id } = req.body || {};

  if (!module || !id) {
    return res.status(400).json({ error: 'module and id required' });
  }

  try {
    const { accessToken, apiDomain } = await getValidZohoAccessToken();

    const response = await axios.get(`${apiDomain}/crm/v2/${module}/${id}`, {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });

    res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    if (error.message === 'ZOHO_NOT_CONNECTED') {
      return res.status(401).json({ error: 'not_connected' });
    }
    res.status(500).json({
      error: 'Failed to fetch record detail',
      details: error.response?.data || error.message,
    });
  }
}
