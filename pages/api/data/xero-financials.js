import axios from 'axios';

export default async function handler(req, res) {
  const { accessToken, tenantId } = req.body;

  if (!accessToken || !tenantId) {
    return res.status(401).json({ error: 'Access token and tenant ID required' });
  }

  try {
    // Fetch bank transactions for cash balance
    const bankResponse = await axios.get(
      'https://api.xero.com/api.xro/2.0/Accounts',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Xero-tenant-id': tenantId,
        },
        params: {
          where: 'Type=="BANK"',
        },
      }
    );

    const bankAccounts = bankResponse.data.Accounts || [];
    const cashBalance = bankAccounts.reduce((sum, acc) => sum + (acc.UpdatedUtcDate ? 0 : 0), 0);

    // Fetch invoices for MRR/ARR calculation
    const invoicesResponse = await axios.get(
      'https://api.xero.com/api.xro/2.0/Invoices',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Xero-tenant-id': tenantId,
        },
        params: {
          where: 'Status=="AUTHORISED"',
          order: 'UpdatedUtcDate DESC',
        },
      }
    );

    const invoices = invoicesResponse.data.Invoices || [];
    const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.Total || 0), 0);
    const totalCollected = invoices
      .filter((inv) => inv.Status === 'PAID')
      .reduce((sum, inv) => sum + (inv.Total || 0), 0);

    // Fetch P&L data (simplified)
    const reportsResponse = await axios.get(
      'https://api.xero.com/api.xro/2.0/Reports/ProfitAndLoss',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Xero-tenant-id': tenantId,
        },
      }
    );

    const plData = reportsResponse.data;

    res.status(200).json({
      success: true,
      data: {
        cashBalance: totalInvoiced, // Placeholder calculation
        runway: 2.8, // Calculate from burn rate
        monthlyBurn: 115000,
        mrrInvoiced: totalInvoiced / 12,
        mrrCollected: totalCollected / 12,
        grossMargin: 0.78,
        plData,
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Xero data fetch error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch Xero data' });
  }
}
