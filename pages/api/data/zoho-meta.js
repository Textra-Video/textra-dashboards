import axios from 'axios';

export default async function handler(req, res) {
  const { accessToken, apiDomain, module } = req.body;

  if (!accessToken || !apiDomain) {
    return res.status(401).json({ error: 'Access token and apiDomain required' });
  }

  try {
    const url = module
      ? `${apiDomain}/crm/v2/settings/fields?module=${module}`
      : `${apiDomain}/crm/v2/settings/modules`;

    const response = await axios.get(url, {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });

    res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch Zoho metadata',
      details: error.response?.data || error.message,
    });
  }
}
