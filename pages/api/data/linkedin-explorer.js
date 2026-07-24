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
    const accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
    const organizationUrn = 'urn:li:organization:108355800'; // Textra Video

    // Initialize metrics with default values
    let followers = 0;
    let monthlyImpressions = 0;
    let engagementRate = '0%';
    let topPostReach = 0;

    // Try multiple endpoint variations to find working query
    try {
      // Try with timeInterval dimension (followers over time)
      const queries = [
        { name: 'timeInterval', url: `https://api.linkedin.com/rest/dmaOrganizationalPageEdgeAnalytics?q=timeInterval&organizationalPage=${encodeURIComponent(organizationUrn)}` },
        { name: 'dimension', url: `https://api.linkedin.com/rest/dmaOrganizationalPageEdgeAnalytics?q=dimension&organizationalPage=${encodeURIComponent(organizationUrn)}&dimension=FollowerCountsByFollowerOrigin` },
        { name: 'trend', url: `https://api.linkedin.com/rest/dmaOrganizationalPageEdgeAnalytics?q=trend&organizationalPage=${encodeURIComponent(organizationUrn)}` },
      ];

      for (const query of queries) {
        console.log(`[LinkedIn] Trying ${query.name} endpoint...`);
        try {
          const edgeRes = await fetch(query.url, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/vnd.linkedin.v2+json',
              'LinkedIn-Version': '202410',
            },
          });

          console.log(`[LinkedIn] ${query.name} response status:`, edgeRes.status);
          const edgeData = await edgeRes.json();
          console.log(`[LinkedIn] ${query.name} response:`, JSON.stringify(edgeData).substring(0, 300));

          if (edgeRes.ok && edgeData.elements && edgeData.elements.length > 0) {
            // Extract data based on response structure
            const element = edgeData.elements[0];
            followers = element?.followerCount || element?.followerCountsByFollowerOrigin?.organizationFollowerCount || 0;
            monthlyImpressions = element?.pageImpressionsCount || element?.impressionCount || 0;

            if (followers > 0 || monthlyImpressions > 0) {
              console.log(`[LinkedIn] Got data from ${query.name} - followers: ${followers}, impressions: ${monthlyImpressions}`);
              break; // Exit loop if we found data
            }
          }
        } catch (queryErr) {
          console.log(`[LinkedIn] ${query.name} error:`, queryErr.message);
          continue;
        }
      }

      if (followers === 0 && monthlyImpressions === 0) {
        console.log('[LinkedIn] No data found in any endpoint variation');
      }
    } catch (err) {
      console.log('[LinkedIn] Error in edge analytics:', err.message);
    }

    // Fetch organizational page content analytics (engagement, posts)
    try {
      const contentRes = await fetch(
        `https://api.linkedin.com/rest/dmaOrganizationalPageContentAnalytics?q=postGestures&organizationalPage=${encodeURIComponent(organizationUrn)}&projection=(elements*(engagement,likes,comments,shares))`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/vnd.linkedin.v2+json',
          },
        }
      );

      if (contentRes.ok) {
        const data = await contentRes.json();
        if (data.elements && data.elements.length > 0) {
          // Calculate engagement metrics from content data
          const engagement = data.elements.reduce((sum, el) => sum + (el.engagement || 0), 0);
          const totalInteractions = data.elements.reduce((sum, el) => sum + ((el.likes || 0) + (el.comments || 0) + (el.shares || 0)), 0);

          if (engagement > 0) {
            engagementRate = ((totalInteractions / engagement) * 100).toFixed(1) + '%';
          }

          topPostReach = data.elements[0]?.engagement || 0;
        }
      } else if (contentRes.status === 403) {
        console.log('[LinkedIn] Access denied to content analytics');
      } else {
        console.log('[LinkedIn] Content analytics error:', contentRes.status, contentRes.statusText);
      }
    } catch (err) {
      console.log('[LinkedIn] Could not fetch content analytics:', err.message);
    }

    // Return available LinkedIn metrics structure with fetched data
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
