// Google Analytics Data API Explorer
// Fetches real metrics from your Google Analytics property
// Requires: GOOGLE_ANALYTICS_PROPERTY_ID and GOOGLE_ANALYTICS_CREDENTIALS

import { BetaAnalyticsDataClient } from '@google-analytics/data';

function fmtDuration(seconds) {
  const s = Math.round(seconds || 0);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}

export default async function handler(req, res) {
  if (!process.env.GOOGLE_ANALYTICS_PROPERTY_ID || !process.env.GOOGLE_ANALYTICS_CREDENTIALS) {
    return res.status(401).json({
      error: 'Google Analytics not connected',
      message: 'Missing GOOGLE_ANALYTICS_PROPERTY_ID or GOOGLE_ANALYTICS_CREDENTIALS',
      setupInstructions: {
        step1: 'Create a service account in Google Cloud Console',
        step2: 'Download the JSON key',
        step3: 'Add GOOGLE_ANALYTICS_PROPERTY_ID and encoded GOOGLE_ANALYTICS_CREDENTIALS to environment',
      },
    });
  }

  try {
    const credentialsJson = Buffer.from(process.env.GOOGLE_ANALYTICS_CREDENTIALS, 'base64').toString('utf-8');
    const credentials = JSON.parse(credentialsJson);
    const analyticsDataClient = new BetaAnalyticsDataClient({ credentials });
    const propertyId = process.env.GOOGLE_ANALYTICS_PROPERTY_ID;

    const { startDate, endDate } = req.query;
    const dateRange = {
      startDate: startDate || '30daysAgo',
      endDate: endDate || 'today',
    };

    // Core summary metrics
    const response = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [dateRange],
      metrics: [
        { name: 'activeUsers' },
        { name: 'newUsers' },
        { name: 'sessions' },
        { name: 'bounceRate' },
        { name: 'engagementRate' },
        { name: 'averageSessionDuration' },
        { name: 'screenPageViews' },
        { name: 'conversions' },
      ],
    });

    let totalUsers = 0, newUsers = 0, totalSessions = 0, pageViews = 0, conversions = 0;
    let bounceRate = '0%', engagementRate = '0%', averageSessionDuration = '0m 0s';

    if (response[0].rows?.length > 0) {
      const row = response[0].rows[0];
      totalUsers = parseInt(row.metricValues[0].value) || 0;
      newUsers = parseInt(row.metricValues[1].value) || 0;
      totalSessions = parseInt(row.metricValues[2].value) || 0;
      bounceRate = (parseFloat(row.metricValues[3].value) * 100).toFixed(1) + '%';
      engagementRate = (parseFloat(row.metricValues[4].value) * 100).toFixed(1) + '%';
      averageSessionDuration = fmtDuration(parseFloat(row.metricValues[5].value));
      pageViews = parseInt(row.metricValues[6].value) || 0;
      conversions = parseInt(row.metricValues[7].value) || 0;
    }

    // Traffic source breakdown (real data, for the Sessions card drilldown)
    let channelBreakdown = [];
    try {
      const channelRes = await analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [dateRange],
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 8,
      });
      channelBreakdown = (channelRes[0].rows || []).map((r) => ({
        label: r.dimensionValues[0].value,
        value: parseInt(r.metricValues[0].value) || 0,
      }));
    } catch (e) {
      console.log('[GA] Channel breakdown unavailable:', e.message);
    }

    // Device breakdown (real data, for a Users card drilldown)
    let deviceBreakdown = [];
    try {
      const deviceRes = await analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [dateRange],
        dimensions: [{ name: 'deviceCategory' }],
        metrics: [{ name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      });
      deviceBreakdown = (deviceRes[0].rows || []).map((r) => ({
        label: r.dimensionValues[0].value,
        value: parseInt(r.metricValues[0].value) || 0,
      }));
    } catch (e) {
      console.log('[GA] Device breakdown unavailable:', e.message);
    }

    // Top pages (real data, for a Page Views card drilldown)
    let topPages = [];
    try {
      const pagesRes = await analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [dateRange],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 8,
      });
      topPages = (pagesRes[0].rows || []).map((r) => ({
        label: r.dimensionValues[0].value,
        value: parseInt(r.metricValues[0].value) || 0,
      }));
    } catch (e) {
      console.log('[GA] Top pages unavailable:', e.message);
    }

    // City breakdown (real data, for a geographic drilldown)
    let cityBreakdown = [];
    try {
      const cityRes = await analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [dateRange],
        dimensions: [{ name: 'city' }],
        metrics: [{ name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 8,
      });
      cityBreakdown = (cityRes[0].rows || []).map((r) => ({
        label: r.dimensionValues[0].value,
        value: parseInt(r.metricValues[0].value) || 0,
      }));
    } catch (e) {
      console.log('[GA] City breakdown unavailable:', e.message);
    }

    // Session source/medium (real data - where sessions actually came from)
    let sessionSourceMedium = [];
    try {
      const sessRes = await analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [dateRange],
        dimensions: [{ name: 'sessionSourceMedium' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 8,
      });
      sessionSourceMedium = (sessRes[0].rows || []).map((r) => ({
        label: r.dimensionValues[0].value,
        value: parseInt(r.metricValues[0].value) || 0,
      }));
    } catch (e) {
      console.log('[GA] Session source/medium unavailable:', e.message);
    }

    // First-user source/medium (real data - where new users were first acquired from)
    let firstUserSourceMedium = [];
    try {
      const fuRes = await analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [dateRange],
        dimensions: [{ name: 'firstUserSourceMedium' }],
        metrics: [{ name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 8,
      });
      firstUserSourceMedium = (fuRes[0].rows || []).map((r) => ({
        label: r.dimensionValues[0].value,
        value: parseInt(r.metricValues[0].value) || 0,
      }));
    } catch (e) {
      console.log('[GA] First-user source/medium unavailable:', e.message);
    }

    // Event count + avg engagement time per user (real data)
    let eventCount = 0, avgEngagementTimePerUser = '0m 0s';
    try {
      const engRes = await analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [dateRange],
        metrics: [{ name: 'eventCount' }, { name: 'userEngagementDuration' }, { name: 'activeUsers' }],
      });
      if (engRes[0].rows?.length > 0) {
        const row = engRes[0].rows[0];
        eventCount = parseInt(row.metricValues[0].value) || 0;
        const totalEngagementSeconds = parseFloat(row.metricValues[1].value) || 0;
        const activeUsersForEng = parseInt(row.metricValues[2].value) || 1;
        avgEngagementTimePerUser = fmtDuration(totalEngagementSeconds / activeUsersForEng);
      }
    } catch (e) {
      console.log('[GA] Event count/engagement time unavailable:', e.message);
    }

    res.status(200).json({
      success: true,
      message: 'Google Analytics Explorer - Available Metrics',
      propertyId,
      dateRange,
      summary: {
        totalUsers,
        newUsers,
        totalSessions,
        pageViews,
        averageSessionDuration,
        avgEngagementTimePerUser,
        eventCount,
        bounceRate,
        engagementRate,
        conversions,
      },
      breakdowns: {
        channelBreakdown,
        deviceBreakdown,
        cityBreakdown,
        sessionSourceMedium,
        firstUserSourceMedium,
        topPages,
      },
      // Not wired up - GA4 tracks these under different setups (ecommerce,
      // custom events, Search Console linking) that this property doesn't have.
      unavailable: ['Total Revenue (requires ecommerce tracking)', 'Organic Search Clicks (requires Search Console link)'],
    });
  } catch (error) {
    console.error('Google Analytics explorer error:', error.message);
    res.status(500).json({
      error: 'Failed to fetch Google Analytics data',
      message: error.message,
    });
  }
}
