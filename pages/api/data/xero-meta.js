import axios from 'axios';
import { getValidXeroAccessToken } from '../../../lib/xeroAuth';

// Temporary introspection endpoint - proxies any Xero Accounting API GET
// path so we can discover what data is actually available before building
// real dashboard metrics on top of it. Not linked from the UI.
export default async function handler(req, res) {
  const { path, params } = req.body || {};

  if (!path) {
    return res.status(400).json({ error: 'path required, e.g. "Accounts" or "Reports/ProfitAndLoss"' });
  }

  try {
    const { accessToken, tenantId } = await getValidXeroAccessToken();

    const response = await axios.get(`https://api.xero.com/api.xro/2.0/${path}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Xero-tenant-id': tenantId,
        Accept: 'application/json',
      },
      params: params || {},
    });

    res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    if (error.message === 'XERO_NOT_CONNECTED') {
      return res.status(401).json({ error: 'not_connected' });
    }
    res.status(500).json({
      error: 'Failed to fetch Xero data',
      details: error.response?.data || error.message,
    });
  }
}
