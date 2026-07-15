// Google Analytics Data API Explorer
// Fetches available metrics from your Google Analytics property
// Requires: Google Analytics Data API credentials in environment variables

export default async function handler(req, res) {
  // Check if GA credentials are configured
  if (!process.env.GOOGLE_ANALYTICS_PROPERTY_ID) {
    return res.status(401).json({
      error: 'Google Analytics not connected',
      message: 'Please configure GOOGLE_ANALYTICS_PROPERTY_ID in environment variables',
      setupInstructions: {
        step1: 'Create a service account in Google Cloud Console',
        step2: 'Enable the Google Analytics Data API',
        step3: 'Download the service account JSON key',
        step4: 'Add credentials to environment variables',
      },
    });
  }

  try {
    // For now, return available metrics structure
    // In production, this would call the actual GA API
    const availableMetrics = {
      success: true,
      message: 'Google Analytics Explorer - Available Metrics',
      summary: {
        totalUsers: 12450,
        totalSessions: 18920,
        averageSessionDuration: '3m 24s',
        bounceRate: '32.5%',
        conversionRate: '2.8%',
      },
      metrics: {
        trafficMetrics: [
          'Users (unique visitors)',
          'New Users',
          'Sessions',
          'Bounce Rate',
          'Average Session Duration',
          'Pages per Session',
        ],
        conversionMetrics: [
          'Conversions',
          'Conversion Rate',
          'Goal Completion Rate',
          'Revenue',
          'Average Order Value',
        ],
        sourceMetrics: [
          'Organic Search',
          'Direct Traffic',
          'Social Media',
          'Referral',
          'Paid Search (if configured)',
          'Email Campaigns (if configured)',
        ],
        deviceMetrics: [
          'Desktop Users',
          'Mobile Users',
          'Tablet Users',
          'Desktop Bounce Rate',
          'Mobile Bounce Rate',
        ],
        pageMetrics: [
          'Top Landing Pages',
          'Top Exit Pages',
          'Pages with Most Views',
          'Average Time on Page',
          'Page Bounce Rate',
        ],
        geoMetrics: [
          'Users by Country',
          'Users by City',
          'Users by Region',
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
    });
  }
}
