import axios from 'axios';

function isSameMonth(dateStr, now) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export default async function handler(req, res) {
  const { accessToken, apiDomain } = req.body;

  if (!accessToken) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    // Zoho tokens are only valid against the datacenter that issued them.
    // apiDomain comes from the OAuth token exchange response, so use it
    // when we have it instead of guessing which datacenter to call.
    let dealsResponse;
    const endpoints = apiDomain
      ? [`${apiDomain}/crm/v2/Deals`]
      : [
          'https://www.zohoapis.com/crm/v2/Deals',
          'https://www.zohoapis.eu/crm/v2/Deals',
          'https://www.zohoapis.in/crm/v2/Deals',
        ];

    for (const endpoint of endpoints) {
      try {
        dealsResponse = await axios.get(endpoint, {
          headers: {
            Authorization: `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json',
          },
          params: {
            fields: 'id,Deal_Name,Amount,Stage,Closing_Date,Owner,Probability,Account_Name',
            per_page: 200,
          },
        });
        break; // Success, exit loop
      } catch (err) {
        if (endpoint === endpoints[endpoints.length - 1]) {
          // Last endpoint, re-throw error
          throw err;
        }
        // Try next endpoint
        continue;
      }
    }

    const deals = dealsResponse.data.data || [];

    // Transform Zoho data to dashboard format
    const transformedDeals = deals.map((deal) => {
      const stage = deal.Stage || 'Unknown';
      const isWon = /won/i.test(stage);
      const isLost = /lost/i.test(stage);
      return {
        id: deal.id,
        name: deal.Deal_Name,
        value: deal.Amount || 0,
        stage,
        isOpen: !isWon && !isLost,
        isWon,
        closeDate: deal.Closing_Date,
        owner: deal.Owner?.name || 'Unassigned',
        probability: deal.Probability || 0,
        account: deal.Account_Name?.name || 'Unknown Client',
      };
    });

    const now = new Date();

    // Total Pipeline: open (not won/lost) deals only
    const openDeals = transformedDeals.filter((d) => d.isOpen);
    const totalPipeline = openDeals.reduce((sum, d) => sum + d.value, 0);

    // Confirmed Bookings: all-time Won deals, per Zoho - no artificial date cutoff
    const wonDeals = transformedDeals.filter((d) => d.isWon);
    const confirmedBookings = wonDeals.reduce((sum, d) => sum + d.value, 0);

    // This Month Close: open deals forecast to close in the current calendar month
    const thisMonthClose = openDeals
      .filter((d) => isSameMonth(d.closeDate, now))
      .reduce((sum, d) => sum + d.value, 0);

    // Monthly Run Rate: Won deals closed in the current calendar month
    const monthlyRunRate = wonDeals
      .filter((d) => isSameMonth(d.closeDate, now))
      .reduce((sum, d) => sum + d.value, 0);

    // Full-funnel view (including Won) for the stage bar chart
    const byStage = {};
    transformedDeals.forEach((deal) => {
      byStage[deal.stage] = (byStage[deal.stage] || 0) + deal.value;
    });

    // Deal-size distribution across open pipeline only
    const bySize = { micro: 0, sme: 0, enterprise: 0 };
    openDeals.forEach((deal) => {
      if (deal.value < 10000) bySize.micro += deal.value;
      else if (deal.value < 50000) bySize.sme += deal.value;
      else bySize.enterprise += deal.value;
    });

    // Stuck deals: open deals overdue against their expected close date by >60 days
    const stuckDeals = openDeals
      .filter((deal) => {
        if (!deal.closeDate) return false;
        const daysOverdue = Math.floor((now - new Date(deal.closeDate)) / (1000 * 60 * 60 * 24));
        return daysOverdue > 60;
      })
      .map((deal) => ({
        ...deal,
        daysOverdue: Math.floor((now - new Date(deal.closeDate)) / (1000 * 60 * 60 * 24)),
      }));

    // Per-client rollup for search / client detail lookups
    const clientMap = {};
    transformedDeals.forEach((deal) => {
      if (!clientMap[deal.account]) {
        clientMap[deal.account] = { name: deal.account, dealCount: 0, totalValue: 0, openValue: 0 };
      }
      clientMap[deal.account].dealCount += 1;
      clientMap[deal.account].totalValue += deal.value;
      if (deal.isOpen) clientMap[deal.account].openValue += deal.value;
    });
    const clients = Object.values(clientMap).sort((a, b) => b.totalValue - a.totalValue);

    res.status(200).json({
      success: true,
      data: {
        deals: transformedDeals,
        clients,
        totalPipeline,
        confirmedBookings,
        thisMonthClose,
        monthlyRunRate,
        byStage,
        bySize,
        stuckDeals,
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Zoho data fetch error:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
      apiDomainReceived: apiDomain,
      accessTokenPrefix: accessToken?.slice(0, 12),
      accessTokenLength: accessToken?.length,
    });
    // Forward Zoho's 401 as our own 401 so the frontend can tell "token
    // expired, try a refresh" apart from other failures worth surfacing.
    const status = error.response?.status === 401 ? 401 : 500;
    res.status(status).json({
      error: 'Failed to fetch Zoho data',
      details: error.response?.data?.message || error.message,
    });
  }
}
