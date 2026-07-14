import axios from 'axios';
import { getValidZohoAccessToken, forceRefreshZohoAccessToken, getCrmRecordUrl } from '../../../lib/zohoAuth';

const STALE_ACTIVITY_DAYS = 30;
const OVERDUE_CLOSE_DAYS = 60;

function isSameMonth(dateStr, now) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function daysBetween(then, now) {
  return Math.floor((now - new Date(then)) / (1000 * 60 * 60 * 24));
}

async function fetchDealsFromZoho(accessToken, apiDomain) {
  // NOTE: Category is not yet a field on Deals in this Zoho instance - once
  // it's added, append its api_name here (and wire it into the transform
  // below and the client-side filter in SalesDashboard.jsx).
  return axios.get(`${apiDomain}/crm/v2/Deals`, {
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json',
    },
    params: {
      fields: [
        'id',
        'Deal_Name',
        'Amount',
        'Stage',
        'Closing_Date',
        'Owner',
        'Probability',
        'Account_Name',
        'Expected_Revenue',
        'Reason_For_Loss__s',
        'Lead_Source',
        'Last_Activity_Time',
        'Contact_Name',
        'Sales_Cycle_Duration',
        'Next_Step',
      ].join(','),
      per_page: 200,
    },
  });
}

export default async function handler(req, res) {
  try {
    let { accessToken, apiDomain } = await getValidZohoAccessToken();

    let dealsResponse;
    try {
      dealsResponse = await fetchDealsFromZoho(accessToken, apiDomain);
    } catch (err) {
      // Cached token looked fresh but Zoho rejected it anyway (clock skew,
      // manual revoke) - force one refresh and retry before giving up.
      if (err.response?.status === 401) {
        ({ accessToken, apiDomain } = await forceRefreshZohoAccessToken());
        dealsResponse = await fetchDealsFromZoho(accessToken, apiDomain);
      } else {
        throw err;
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
        crmUrl: getCrmRecordUrl(apiDomain, 'Deals', deal.id),
        value: deal.Amount || 0,
        expectedRevenue: deal.Expected_Revenue || 0,
        stage,
        isOpen: !isWon && !isLost,
        isWon,
        isLost,
        closeDate: deal.Closing_Date,
        owner: deal.Owner?.name || 'Unassigned',
        probability: deal.Probability || 0,
        account: deal.Account_Name?.name || 'Unknown Client',
        contact: deal.Contact_Name?.name || null,
        reasonForLoss: deal.Reason_For_Loss__s || null,
        leadSource: deal.Lead_Source || 'Unknown',
        lastActivity: deal.Last_Activity_Time || null,
        salesCycleDuration: typeof deal.Sales_Cycle_Duration === 'number' ? deal.Sales_Cycle_Duration : null,
        nextStep: deal.Next_Step || null,
        // Placeholder until the Category field exists in Zoho - keeps the
        // frontend filter wired up without needing another shape change.
        category: deal.Category || null,
      };
    });

    const now = new Date();

    // Total Pipeline: open (not won/lost) deals only
    const openDeals = transformedDeals.filter((d) => d.isOpen);
    const totalPipeline = openDeals.reduce((sum, d) => sum + d.value, 0);

    // Weighted Forecast: Zoho's own Amount x Probability% per deal, summed
    // across open pipeline - a real forecast instead of a flat guess.
    const weightedForecast = openDeals.reduce((sum, d) => sum + d.expectedRevenue, 0);

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

    // Avg Sales Cycle: mean days-to-close across Won deals that have a
    // recorded duration
    const wonWithDuration = wonDeals.filter((d) => d.salesCycleDuration !== null);
    const avgSalesCycle = wonWithDuration.length
      ? Math.round(wonWithDuration.reduce((sum, d) => sum + d.salesCycleDuration, 0) / wonWithDuration.length)
      : null;

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

    // Pipeline by Source: open pipeline value grouped by Lead_Source
    const bySource = {};
    openDeals.forEach((deal) => {
      bySource[deal.leadSource] = (bySource[deal.leadSource] || 0) + deal.value;
    });

    // Why We Lose: count of Closed Lost deals grouped by Reason_For_Loss__s
    const lostDeals = transformedDeals.filter((d) => d.isLost);
    const lossReasons = {};
    lostDeals.forEach((deal) => {
      const reason = deal.reasonForLoss || 'No reason recorded';
      lossReasons[reason] = (lossReasons[reason] || 0) + 1;
    });

    // Stuck deals: open deals overdue against their expected close date
    const stuckDeals = openDeals
      .filter((deal) => deal.closeDate && daysBetween(deal.closeDate, now) > OVERDUE_CLOSE_DAYS)
      .map((deal) => ({ ...deal, daysOverdue: daysBetween(deal.closeDate, now) }));

    // Stale deals: open deals with no activity in 30+ days (or never any
    // recorded activity at all) - a stronger signal than an overdue close
    // date, since a deal can be on-track with activity even past its
    // original close estimate.
    const staleDeals = openDeals
      .filter((deal) => !deal.lastActivity || daysBetween(deal.lastActivity, now) > STALE_ACTIVITY_DAYS)
      .map((deal) => ({
        ...deal,
        daysSinceActivity: deal.lastActivity ? daysBetween(deal.lastActivity, now) : null,
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
        weightedForecast,
        confirmedBookings,
        thisMonthClose,
        monthlyRunRate,
        avgSalesCycle,
        byStage,
        bySize,
        bySource,
        lossReasons,
        stuckDeals,
        staleDeals,
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    if (error.message === 'ZOHO_NOT_CONNECTED') {
      return res.status(401).json({ error: 'not_connected', details: 'Zoho CRM has not been connected yet.' });
    }
    console.error('Zoho data fetch error:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    const status = error.response?.status === 401 ? 401 : 500;
    res.status(status).json({
      error: 'Failed to fetch Zoho data',
      details: error.response?.data?.message || error.message,
    });
  }
}
