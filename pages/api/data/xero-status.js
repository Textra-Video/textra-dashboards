import { isXeroConnected, getStoredXeroTokens } from '../../../lib/xeroAuth';

export default async function handler(req, res) {
  try {
    const connected = await isXeroConnected();
    const tokens = connected ? await getStoredXeroTokens() : null;
    res.status(200).json({ connected, tenantName: tokens?.tenantName || null });
  } catch (error) {
    console.error('Xero status check error:', error.message);
    res.status(500).json({ error: 'Failed to check Xero connection status' });
  }
}
