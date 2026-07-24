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
    let debugResponses = [];  // Store endpoint responses for debugging

    // First, verify organization exists and get page info
    try {
      console.log('[LinkedIn] Verifying organization access...');
      const verifyRes = await fetch(`https://api.linkedin.com/rest/organizations/${organizationUrn.split(':').pop()}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.linkedin.v2+json',
          'LinkedIn-Version': '202405',
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

    // Try multiple endpoint variations with proper date ranges
    try {
      // Calculate date range (last 30 days in milliseconds)
      const endDate = Date.now();
      const startDate = endDate - (30 * 24 * 60 * 60 * 1000);

      const queries = [
        {
          name: 'organizationalPageAnalytics with dateRange',
          url: `https://api.linkedin.com/rest/dmaOrganizationalPageAnalytics?organizationalPage=urn%3Ali%3Aorganization%3A108355800&q=dateRange&dateRange.start=${startDate}&dateRange.end=${endDate}`,
        },
        {
          name: 'organizationalPageAnalytics simple',
          url: `https://api.linkedin.com/rest/dmaOrganizationalPageAnalytics?organizationalPage=urn%3Ali%3Aorganization%3A108355800`,
        },
        {
          name: 'organizationalPageEdgeAnalytics',
          url: `https://api.linkedin.com/rest/dmaOrganizationalPageEdgeAnalytics?organizationalPage=urn%3Ali%3Aorganization%3A108355800`,
        },
        {
          name: 'pageAnalytics',
          url: `https://api.linkedin.com/rest/pageAnalytics?q=organization&organization=urn%3Ali%3Aorganization%3A108355800`,
        }
      ];

      for (const query of queries) {
        console.log(`[LinkedIn] Trying ${query.name}...`);
        try {
          const res = await fetch(query.url, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/vnd.linkedin.v2+json',
              'LinkedIn-Version': '202405',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
          });

          console.log(`[LinkedIn] ${query.name} status: ${res.status}`);

          const text = await res.text();
          const data = JSON.parse(text);

          // Store response for debugging
          debugResponses.push({
            endpoint: query.name,
            status: res.status,
            keys: Object.keys(data).join(', '),
            elementCount: data.elements?.length || 0,
            preview: text.substring(0, 300),
          });

          // Try to extract metrics from various response structures
          if (data.elements && Array.isArray(data.elements) && data.elements.length > 0) {
            const element = data.elements[0];
            const elementKeys = Object.keys(element).join(', ');
            debugResponses[debugResponses.length - 1].elementKeys = elementKeys;

            // Try common field names
            if (element.impressionCount) monthlyImpressions = element.impressionCount;
            if (element.likeCount) followers = element.likeCount;
            if (element.followerCount) followers = element.followerCount;
            if (element.pageImpressionsCount) monthlyImpressions = element.pageImpressionsCount;

            if (monthlyImpressions > 0 || followers > 0) {
              console.log(`[LinkedIn] Found data in ${query.name}!`);
              break;
            }
          }

          if (data.impressionCount) monthlyImpressions = data.impressionCount;
          if (data.likeCount) followers = data.likeCount;

          if (monthlyImpressions > 0 || followers > 0) {
            console.log(`[LinkedIn] Found data in root of ${query.name}!`);
            break;
          }
        } catch (queryErr) {
          console.log(`[LinkedIn] ${query.name} error:`, queryErr.message);
          continue;
        }
      }

      if (followers === 0 && monthlyImpressions === 0) {
        console.log('[LinkedIn] No data found in any endpoint - checking if token/org is misconfigured');
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
            'LinkedIn-Version': '202405',
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
        endpointResponses: debugResponses,
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
