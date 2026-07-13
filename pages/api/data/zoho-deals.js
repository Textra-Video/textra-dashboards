import axios from 'axios';

export default async function handler(req, res) {
  const { accessToken } = req.body;

  if (!accessToken) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    // Fetch deals from Zoho CRM
    const dealsResponse = await axios.get(
      'https://www.zohoapis.com/crm/v2/Deals',
      {
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json',
        },
        params: {
          fields: 'id,Deal_Name,Amount,Stage,Closing_Date,Owner,Probability',
          per_page: 200,
        },
      }
    );

    const deals = dealsResponse.data.data || [];

    // Transform Zoho data to dashboard format
    const transformedDeals = deals.map((deal) => ({
      id: deal.id,
      name: deal.Deal_Name,
      value: deal.Amount || 0,
      stage: deal.Stage || 'Unknown',
      closeDate: deal.Closing_Date,
      owner: deal.Owner?.name || 'Unassigned',
      probability: deal.Probability || 0,
    }));

    // Calculate metrics
    const totalPipeline = transformedDeals.reduce((sum, d) => sum + d.value, 0);
    const byStage = {};
    const bySize = { micro: 0, sme: 0, enterprise: 0 };

    transformedDeals.forEach((deal) => {
      byStage[deal.stage] = (byStage[deal.stage] || 0) + deal.value;

      if (deal.value < 10000) bySize.micro += deal.value;
      else if (deal.value < 50000) bySize.sme += deal.value;
      else bySize.enterprise += deal.value;
    });

    // Identify stuck deals (>60 days in stage)
    const now = new Date();
    const stuckDeals = transformedDeals.filter((deal) => {
      if (!deal.closeDate) return false;
      const daysInStage = Math.floor(
        (now - new Date(deal.closeDate)) / (1000 * 60 * 60 * 24)
      );
      return daysInStage > 60;
    });

    res.status(200).json({
      success: true,
      data: {
        deals: transformedDeals,
        totalPipeline,
        byStage,
        bySize,
        stuckDeals,
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Zoho data fetch error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch Zoho data' });
  }
}
