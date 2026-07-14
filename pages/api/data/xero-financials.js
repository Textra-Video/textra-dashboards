import axios from 'axios';
import { getValidXeroAccessToken, forceRefreshXeroAccessToken } from '../../../lib/xeroAuth';

// TEMPORARY: returns real connected bank accounts only. The previous
// version of this endpoint fabricated cashBalance/runway/monthlyBurn/
// grossMargin as hardcoded constants - removed rather than kept lying.
// Real metrics get built once we've queried the Xero API to see what's
// actually available (same approach used for the Sales/Zoho dashboard).
async function fetchAccounts(accessToken, tenantId) {
  return axios.get('https://api.xero.com/api.xro/2.0/Accounts', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Xero-tenant-id': tenantId,
      Accept: 'application/json',
    },
    params: { where: 'Type=="BANK"' },
  });
}

export default async function handler(req, res) {
  try {
    let { accessToken, tenantId } = await getValidXeroAccessToken();

    let response;
    try {
      response = await fetchAccounts(accessToken, tenantId);
    } catch (err) {
      if (err.response?.status === 401) {
        ({ accessToken, tenantId } = await forceRefreshXeroAccessToken());
        response = await fetchAccounts(accessToken, tenantId);
      } else {
        throw err;
      }
    }

    const bankAccounts = (response.data.Accounts || []).map((acc) => ({
      name: acc.Name,
      code: acc.Code,
      currency: acc.CurrencyCode,
      status: acc.Status,
    }));

    res.status(200).json({
      success: true,
      data: {
        bankAccounts,
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    if (error.message === 'XERO_NOT_CONNECTED') {
      return res.status(401).json({ error: 'not_connected' });
    }
    console.error('Xero data fetch error:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    const status = error.response?.status === 401 ? 401 : 500;
    res.status(status).json({
      error: 'Failed to fetch Xero data',
      details: error.response?.data?.Detail || error.message,
    });
  }
}
