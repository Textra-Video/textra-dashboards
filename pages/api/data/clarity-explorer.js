// "Microsoft Clarity" Explorer
// IMPORTANT: This does NOT call Microsoft Clarity's own API. It reuses the
// same Google Analytics property as a stand-in, so only session/user/bounce
// numbers are real - genuine Clarity-only data (heatmaps, rage clicks, dead
// clicks, session recordings) requires an actual Clarity API/export
// integration that does not exist in this codebase.
// Requires: GOOGLE_ANALYTICS_CREDENTIALS and GOOGLE_ANALYTICS_PROPERTY_ID

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
      message: 'This "Clarity" view is powered by the Google Analytics property - it is not a real Microsoft Clarity integration.',
      setupInstructions: {
        step1: 'Set GOOGLE_ANALYTICS_PROPERTY_ID and GOOGLE_ANALYTICS_CREDENTIALS',
        step2: 'For real Clarity-specific data (heatmaps, rage clicks, recordings), a genuine Clarity API/export integration would need to be built separately',
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

    const response = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [dateRange],
      metrics: [
        { name: 'sessions' },
        { name: 'activeUsers' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
        { name: 'screenPageViewsPerSession' },
      ],
    });

    let totalSessions = 0, uniqueUsers = 0;
    let bounceRate = '0%', avgSessionLength = '0m 0s', pagesPerSession = '0';

    if (response[0].rows?.length > 0) {
      const row = response[0].rows[0];
      totalSessions = parseInt(row.metricValues[0].value) || 0;
      uniqueUsers = parseInt(row.metricValues[1].value) || 0;
      bounceRate = (parseFloat(row.metricValues[2].value) * 100).toFixed(1) + '%';
      avgSessionLength = fmtDuration(parseFloat(row.metricValues[3].value));
      pagesPerSession = parseFloat(row.metricValues[4].value).toFixed(1);
    }

    // Device breakdown - real GA data
    let deviceBreakdown = [];
    try {
      const deviceRes = await analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [dateRange],
        dimensions: [{ name: 'deviceCategory' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      });
      deviceBreakdown = (deviceRes[0].rows || []).map((r) => ({
        label: r.dimensionValues[0].value,
        value: parseInt(r.metricValues[0].value) || 0,
      }));
    } catch (e) {
      console.log('[Clarity/GA] Device breakdown unavailable:', e.message);
    }

    res.status(200).json({
      success: true,
      message: '"Clarity" metrics - actually sourced from Google Analytics, not Microsoft Clarity\'s own API',
      propertyId,
      dataSource: 'Google Analytics (no real Clarity integration exists)',
      dateRange,
      summary: {
        totalSessions,
        uniqueUsers,
        avgSessionLength,
        bounceRate,
        pagesPerSession,
      },
      breakdowns: {
        deviceBreakdown,
      },
      // Real Microsoft Clarity features - none of these are achievable via
      // Google Analytics. Would require Clarity's own API/data export.
      unavailable: [
        'Click Heatmaps', 'Scroll Heatmaps', 'Movement Heatmaps',
        'Rage Clicks', 'Dead Clicks', 'Session Recordings',
        'Form Abandonment Recordings', 'Form Field Analytics',
      ],
    });
  } catch (error) {
    console.error('Clarity explorer error:', error.message);
    res.status(500).json({
      error: 'Failed to fetch Clarity data',
      message: error.message,
    });
  }
}
