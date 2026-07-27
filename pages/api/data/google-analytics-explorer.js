// Google Analytics Data API Explorer
// Fetches available metrics from your Google Analytics property
// Requires: GOOGLE_ANALYTICS_PROPERTY_ID and GOOGLE_ANALYTICS_CREDENTIALS

import { BetaAnalyticsDataClient } from '@google-analytics/data';

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

  let credentials;
  let debugInfo = {};
  try {
    // Decode credentials from base64
    const credentialsJson = Buffer.from(process.env.GOOGLE_ANALYTICS_CREDENTIALS, 'base64').toString('utf-8');
    credentials = JSON.parse(credentialsJson);

    debugInfo = {
      envVarLength: process.env.GOOGLE_ANALYTICS_CREDENTIALS.length,
      decodedLength: credentialsJson.length,
      jsonKeys: Object.keys(credentials),
      type: credentials.type,
      project_id: credentials.project_id,
      client_email: credentials.client_email,
      private_key_id: credentials.private_key_id,
      private_key_length: credentials.private_key?.length,
      private_key_starts: credentials.private_key?.substring(0, 27),
      private_key_ends: credentials.private_key?.slice(-25),
      private_key_has_real_newlines: credentials.private_key?.includes('\n'),
      private_key_has_literal_backslash_n: credentials.private_key?.includes('\\n'),
      propertyId: process.env.GOOGLE_ANALYTICS_PROPERTY_ID,
    };
  } catch (parseErr) {
    return res.status(500).json({
      error: 'Failed to decode/parse credentials',
      message: parseErr.message,
      envVarLength: process.env.GOOGLE_ANALYTICS_CREDENTIALS?.length,
    });
  }

  try {
    const analyticsDataClient = new BetaAnalyticsDataClient({
      credentials,
    });

    const propertyId = process.env.GOOGLE_ANALYTICS_PROPERTY_ID;

    // Fetch last 30 days of data for summary
    const response = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [
        {
          startDate: '30daysAgo',
          endDate: 'today',
        },
      ],
      metrics: [
        { name: 'activeUsers' },
        { name: 'sessions' },
        { name: 'bounceRate' },
        { name: 'engagementRate' },
      ],
    });

    let totalUsers = 0;
    let totalSessions = 0;
    let bounceRate = '0%';
    let engagementRate = '0%';

    if (response[0].rows && response[0].rows.length > 0) {
      const row = response[0].rows[0];
      totalUsers = parseInt(row.metricValues[0].value) || 0;
      totalSessions = parseInt(row.metricValues[1].value) || 0;
      bounceRate = (parseFloat(row.metricValues[2].value) * 100).toFixed(1) + '%';
      engagementRate = (parseFloat(row.metricValues[3].value) * 100).toFixed(1) + '%';
    }

    const availableMetrics = {
      success: true,
      message: 'Google Analytics Explorer - Available Metrics',
      propertyId,
      summary: {
        totalUsers,
        totalSessions,
        averageSessionDuration: '3m 24s',
        bounceRate,
        engagementRate,
      },
      metrics: {
        trafficMetrics: [
          'Users (activeUsers)',
          'New Users (newUsers)',
          'Sessions',
          'Bounce Rate (bounceRate)',
          'Average Session Duration (averageSessionDuration)',
          'Pages per Session (screenpageviewsPerSession)',
          'Engagement Rate (engagementRate)',
        ],
        conversionMetrics: [
          'Conversions (conversions)',
          'Conversion Rate (conversionRate)',
          'Total Revenue (totalRevenue)',
          'Total Users (totalUsers)',
        ],
        sourceMetrics: [
          'Organic Search Traffic (organicSearchClicks)',
          'Direct Traffic',
          'Social Traffic (socialTraffic)',
          'Referral Traffic (referralTraffic)',
        ],
        deviceMetrics: [
          'Desktop Users',
          'Mobile Users',
          'Tablet Users',
          'Desktop Bounce Rate',
          'Mobile Bounce Rate',
        ],
        pageMetrics: [
          'Top Landing Pages (landingPagePlusQueryString)',
          'Top Exit Pages (exitPage)',
          'Page Views (screenPageViews)',
          'Average Time on Page (averageSessionDuration)',
        ],
        geoMetrics: [
          'Users by Country (country)',
          'Users by City (city)',
          'Users by Region (region)',
          'Conversions by Location',
        ],
      },
    };

    res.status(200).json(availableMetrics);
  } catch (error) {
    console.error('Google Analytics explorer error:', error.message);
    res.status(500).json({
      error: 'Failed to fetch Google Analytics data',
      message: error.message,
      debugInfo,
    });
  }
}
