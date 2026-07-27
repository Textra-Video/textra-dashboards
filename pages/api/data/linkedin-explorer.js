// LinkedIn Analytics API Explorer
// Fetches follower/impression metrics for the Textra Video company page via
// LinkedIn's Pages Data Portability API (DMA).
// Requires: LINKEDIN_ACCESS_TOKEN in environment variables (r_dma_admin_pages_content scope)

const LINKEDIN_VERSION = '202605'; // confirmed active via LinkedIn's own changelog

const baseHeaders = (accessToken) => ({
  'Authorization': `Bearer ${accessToken}`,
  'Accept': 'application/json',
  'LinkedIn-Version': LINKEDIN_VERSION,
  'X-Restli-Protocol-Version': '2.0.0',
});

export default async function handler(req, res) {
  if (!process.env.LINKEDIN_ACCESS_TOKEN) {
    return res.status(401).json({
      error: 'LinkedIn not connected',
      message: 'Please configure LINKEDIN_ACCESS_TOKEN in environment variables',
    });
  }

  const accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
  const organizationUrn = 'urn:li:organization:108355800'; // Textra Video

  let followers = 0;
  let monthlyImpressions = 0;
  let engagementRate = '0%';
  let topPostReach = 0;

  try {
    // Step 1: resolve the organizationalPage URN from the organization URN.
    // pageEntity is a union type - must be wrapped as (organization:URN),
    // with the URN's own colons percent-encoded inside the structure.
    const pageEntityRes = await fetch(
      `https://api.linkedin.com/rest/dmaOrganizationalPageProfiles?q=pageEntity&pageEntity=(organization:${encodeURIComponent(organizationUrn)})`,
      { headers: baseHeaders(accessToken) }
    );
    const pageEntityData = await pageEntityRes.json();
    const organizationalPageUrn = pageEntityData.elements?.[0]?.entityUrn;

    if (!organizationalPageUrn) {
      throw new Error(`Could not resolve organizationalPage URN: ${JSON.stringify(pageEntityData)}`);
    }

    // Flat top-level URN query params must also be percent-encoded.
    const encodedPageUrn = encodeURIComponent(organizationalPageUrn);

    // Step 2: follower count via the trend finder (analyticsType=FOLLOWER).
    // Accept optional startDate/endDate (YYYY-MM-DD) query params; default
    // to the last 365 days if not provided.
    const { startDate, endDate } = req.query;
    const end = endDate ? new Date(endDate).getTime() : Date.now();
    const start = startDate ? new Date(startDate).getTime() : end - 365 * 24 * 60 * 60 * 1000;
    const timeIntervals = `(timeRange:(end:${end},start:${start}))`;

    const followerRes = await fetch(
      `https://api.linkedin.com/rest/dmaOrganizationalPageEdgeAnalytics?q=trend&organizationalPage=${encodedPageUrn}&analyticsType=FOLLOWER&timeIntervals=${timeIntervals}`,
      { headers: baseHeaders(accessToken) }
    );
    const followerData = await followerRes.json();

    if (Array.isArray(followerData.elements)) {
      followers = followerData.elements.reduce((sum, el) => {
        const v = el.value?.typeSpecificValue?.followerEdgeAnalyticsValue;
        return sum + (v?.organicValue || 0) + (v?.sponsoredValue || 0);
      }, 0);
    }

    // Step 3: page-level content analytics via the trend finder.
    // postGestures/postDimension require a specific post's URN
    // (sourcePostEntity) - we don't have individual post IDs. trend accepts
    // sourceEntity=organizationalPage URN directly for aggregate metrics.
    let likes = 0, comments = 0, reposts = 0, clicks = 0, uniqueImpressions = 0;
    try {
      const metricTypes = 'List(IMPRESSIONS,UNIQUE_IMPRESSIONS,CLICKS,COMMENTS,REACTIONS,REPOSTS,ENGAGEMENT_RATE)';
      const contentRes = await fetch(
        `https://api.linkedin.com/rest/dmaOrganizationalPageContentAnalytics?q=trend&sourceEntity=${encodedPageUrn}&metricTypes=${metricTypes}&timeIntervals=${timeIntervals}`,
        { headers: baseHeaders(accessToken) }
      );
      const contentData = await contentRes.json();

      if (Array.isArray(contentData.elements)) {
        const totalsByType = {};
        for (const el of contentData.elements) {
          const val = el.metric?.value;
          const count = val?.totalCount?.long ?? val?.totalCount?.bigDecimal ?? 0;
          totalsByType[el.type] = (totalsByType[el.type] || 0) + parseFloat(count);
        }

        monthlyImpressions = totalsByType.IMPRESSIONS || 0;
        uniqueImpressions = totalsByType.UNIQUE_IMPRESSIONS || 0;
        clicks = totalsByType.CLICKS || 0;
        comments = totalsByType.COMMENTS || 0;
        likes = totalsByType.REACTIONS || 0;
        reposts = totalsByType.REPOSTS || 0;
        topPostReach = uniqueImpressions || monthlyImpressions;

        if (totalsByType.ENGAGEMENT_RATE !== undefined) {
          engagementRate = (totalsByType.ENGAGEMENT_RATE * 100).toFixed(1) + '%';
        }
      }
    } catch (contentErr) {
      console.log('[LinkedIn] Content analytics unavailable:', contentErr.message);
    }

    res.status(200).json({
      success: true,
      message: 'LinkedIn Analytics - Available Metrics',
      dateRange: {
        start: new Date(start).toISOString().slice(0, 10),
        end: new Date(end).toISOString().slice(0, 10),
      },
      summary: {
        followers,
        monthlyImpressions,
        engagementRate,
        topPostReach,
        likes,
        comments,
        reposts,
        clicks,
        uniqueImpressions,
      },
      metrics: {
        followersMetrics: ['Total Followers', 'Follower Growth (30 days)', 'Follower Growth Rate', 'New Followers vs Last Month'],
        engagementMetrics: ['Post Impressions', 'Post Clicks', 'Engagement Rate', 'Likes', 'Comments', 'Shares', 'Average Engagement per Post'],
        reachMetrics: ['Unique Impressions', 'Impressions by Post Type', 'Organic Impressions', 'Paid Impressions (if applicable)', 'Viral Impressions'],
        contentMetrics: ['Top Performing Posts', 'Content by Type (image, video, link, etc)', 'Best Posting Times', 'Posts with Most Shares', 'Posts with Most Comments'],
        visitorMetrics: ['Page Views', 'Unique Visitors', 'Search Appearances', 'Visitor Demographics'],
        leadMetrics: ['Lead Gen Forms Opened', 'Lead Gen Forms Submitted', 'LinkedIn Lead Gen (if using forms)', 'CTA Clicks'],
      },
    });
  } catch (error) {
    console.error('LinkedIn explorer error:', error.message);
    res.status(500).json({
      error: 'Failed to fetch LinkedIn data',
      message: error.message,
    });
  }
}
