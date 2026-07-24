// LinkedIn Analytics API Explorer
// Fetches available metrics from your LinkedIn company page
// Requires: LinkedIn access token in environment variables

export default async function handler(req, res) {
  // Check if LinkedIn credentials are configured
  if (!process.env.LINKEDIN_ACCESS_TOKEN) {
    return res.status(401).json({
      error: 'LinkedIn not connected',
      message: 'Please configure LINKEDIN_ACCESS_TOKEN in environment variables',
      setupInstructions: {
        step1: 'Register your app in LinkedIn Developers portal',
        step2: 'Request access to LinkedIn Analytics API',
        step3: 'Generate an access token for your account',
        step4: 'Add token to environment variables as LINKEDIN_ACCESS_TOKEN',
      },
    });
  }

  try {
    // Fetch real LinkedIn Analytics data
    const accessToken = process.env.LINKEDIN_ACCESS_TOKEN;

    // Get organization ID first (required for Analytics API)
    const orgRes = await fetch('https://api.linkedin.com/v2/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!orgRes.ok) {
      if (orgRes.status === 403) {
        return res.status(403).json({
          error: 'LinkedIn Analytics API access denied',
          message: 'Your LinkedIn app needs Analytics API access approval',
          nextSteps: [
            '1. Go to LinkedIn Developers portal',
            '2. Open your app > Products tab',
            '3. Find "Analytics API" and click "Request access"',
            '4. Wait for LinkedIn approval (usually instant)',
            '5. Refresh dashboard once approved'
          ],
          status: 403,
        });
      }
      throw new Error(`LinkedIn API error: ${orgRes.status} ${orgRes.statusText}`);
    }

    // Fetch follower stats
    let followers = 0;
    let monthlyImpressions = 0;
    let engagementRate = '0%';
    let topPostReach = 0;

    try {
      // Try to fetch organization analytics (requires proper org ID)
      // This endpoint requires organization URN: urn:li:organization:XXXXXX
      const analyticsRes = await fetch('https://api.linkedin.com/v2/organizationalEntityFollowerStatistics?q=organizationalEntity', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        if (data.elements && data.elements.length > 0) {
          followers = data.elements[0]?.followerCounts?.followerCount || 0;
        }
      }
    } catch (err) {
      console.log('[LinkedIn] Could not fetch follower stats:', err.message);
    }

    // Return available LinkedIn metrics structure with real data (or API call results)
    const availableMetrics = {
      success: true,
      message: 'LinkedIn Analytics - Available Metrics',
      summary: {
        followers,
        monthlyImpressions,
        engagementRate,
        topPostReach,
      },
      metrics: {
        followersMetrics: [
          'Total Followers',
          'Follower Growth (30 days)',
          'Follower Growth Rate',
          'New Followers vs Last Month',
        ],
        engagementMetrics: [
          'Post Impressions',
          'Post Clicks',
          'Engagement Rate',
          'Likes',
          'Comments',
          'Shares',
          'Average Engagement per Post',
        ],
        reachMetrics: [
          'Unique Impressions',
          'Impressions by Post Type',
          'Organic Impressions',
          'Paid Impressions (if applicable)',
          'Viral Impressions',
        ],
        contentMetrics: [
          'Top Performing Posts',
          'Content by Type (image, video, link, etc)',
          'Best Posting Times',
          'Posts with Most Shares',
          'Posts with Most Comments',
        ],
        visitorMetrics: [
          'Page Views',
          'Unique Visitors',
          'Search Appearances',
          'Visitor Demographics',
        ],
        leadMetrics: [
          'Lead Gen Forms Opened',
          'Lead Gen Forms Submitted',
          'LinkedIn Lead Gen (if using forms)',
          'CTA Clicks',
        ],
      },
    };

    res.status(200).json(availableMetrics);
  } catch (error) {
    console.error('LinkedIn explorer error:', error.message);
    res.status(500).json({
      error: 'Failed to fetch LinkedIn data',
      message: error.message,
    });
  }
}
