import axios from 'axios';

export default async function handler(req, res) {
  const { accessToken, apiDomain, module, id } = req.body;

  if (!accessToken || !apiDomain || !module || !id) {
    return res.status(401).json({ error: 'accessToken, apiDomain, module and id required' });
  }

  try {
    const response = await axios.get(`${apiDomain}/crm/v2/${module}/${id}`, {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });

    res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch record detail',
      details: error.response?.data || error.message,
    });
  }
}
