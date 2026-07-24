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

    // First, verify organization exists and get page info
    try {
      console.log('[LinkedIn] Verifying organization access...');
      const verifyRes = await fetch(`https://api.linkedin.com/rest/organizations/${organizationUrn.split(':').pop()}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.linkedin.v2+json',
        },
      });
      console.log('[LinkedIn] Organization verify status:', verifyRes.status);
      if (verifyRes.ok) {
        const orgData = await verifyRes.json();
        console.log('[LinkedIn] Organization data:', JSON.stringify(orgData).substring(0, 200));
      }
    } catch (err) {
      console.log('[LinkedIn] Could not verify organization:', err.message);
    }

    // Try multiple endpoint variations to find working query
    try {
      const queries = [
        {
          name: 'follower count',
          url: `https://api.linkedin.com/rest/dmaOrganizationalPageEdgeAnalytics?q=dimension&organizationalPage=urn%3Ali%3Aorganization%3A108355800&dimensions=List(FollowerCount)`,
          fields: 'followerCount'
        },
        {
          name: 'page details',
          url: `https://api.linkedin.com/rest/dmaOrganizationalPageEdgeAnalytics?organizationalPage=urn%3Ali%3Aorganization%3A108355800`,
          fields: 'none'
        },
        {
          name: 'analytics summary',
          url: `https://api.linkedin.com/rest/dmaOrganizationalPageAnalytics?organizationalPage=urn%3Ali%3Aorganization%3A108355800`,
          fields: 'summary'
        }
      ];

      for (const query of queries) {
        console.log(`[LinkedIn] Trying ${query.name}...`);
        try {
          const res = await fetch(query.url, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/vnd.linkedin.v2+json',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
          });

          console.log(`[LinkedIn] ${query.name} status: ${res.status}`);

          const text = await res.text();
          console.log(`[LinkedIn] ${query.name} response:`, text.substring(0, 600));

          const data = JSON.parse(text);

          // Try to extract follower count from various possible locations
          if (data.followerCount) {
            followers = data.followerCount;
            console.log('[LinkedIn] Found followerCount in root:', followers);
          }
          if (data.elements?.[0]?.followerCount) {
            followers = data.elements[0].followerCount;
            console.log('[LinkedIn] Found followerCount in elements:', followers);
          }
          if (data.elements?.[0]?.value?.followerCount) {
            followers = data.elements[0].value.followerCount;
            console.log('[LinkedIn] Found followerCount in elements[0].value:', followers);
          }

          if (followers > 0) {
            console.log('[LinkedIn] Successfully found follower data');
            break;
          }
        } catch (queryErr) {
          console.log(`[LinkedIn] ${query.name} error:`, queryErr.message);
          continue;
        }
      }

      if (followers === 0) {
        console.log('[LinkedIn] Could not retrieve any analytics data - token may lack required scopes or organization has no analytics data');
      }
    } catch (err) {
      console.log('[LinkedIn] Error in analytics queries:', err.message);
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
      debug: {
        organization: 'urn:li:organization:108355800',
        tokenConfigured: !!process.env.LINKEDIN_ACCESS_TOKEN,
        tokenLength: process.env.LINKEDIN_ACCESS_TOKEN?.length || 0,
        followersFound: followers,
        impressionsFound: monthlyImpressions,
      },
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
