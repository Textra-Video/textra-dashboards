import { isZohoConnected } from '../../../lib/zohoAuth';

export default async function handler(req, res) {
  try {
    const connected = await isZohoConnected();
    res.status(200).json({ connected });
  } catch (error) {
    console.error('Zoho status check error:', error.message);
    res.status(500).json({ error: 'Failed to check Zoho connection status' });
  }
}
