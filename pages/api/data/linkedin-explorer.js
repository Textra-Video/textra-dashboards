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
    // pageEntity is a union type - must be wrapped as (organization:URN).
    const pageEntityRes = await fetch(
      `https://api.linkedin.com/rest/dmaOrganizationalPageProfiles?q=pageEntity&pageEntity=(organization:${encodeURIComponent(organizationUrn)})`,
      { headers: baseHeaders(accessToken) }
    );
    const pageEntityData = await pageEntityRes.json();
    const organizationalPageUrn = pageEntityData.elements?.[0]?.entityUrn;

    if (!organizationalPageUrn) {
      throw new Error(`Could not resolve organizationalPage URN: ${JSON.stringify(pageEntityData)}`);
    }

    // Step 2: follower count via the trend finder (analyticsType=FOLLOWER).
    // timeIntervals is required for trend; use a wide range to catch the
    // page's full follower history in one call.
    const now = Date.now();
    const start = now - 365 * 24 * 60 * 60 * 1000;
    // Match the doc's exact sample field order (end before start).
    const timeIntervals = `(timeRange:(end:${now},start:${start}))`;

    const timeIntervalsWithGranularity = `(timeRange:(end:${now},start:${start}),timeGranularityType:MONTH)`;

    const followerVariants = [
      {
        name: 'trend (as-is)',
        url: `https://api.linkedin.com/rest/dmaOrganizationalPageEdgeAnalytics?q=trend&organizationalPage=${organizationalPageUrn}&analyticsType=FOLLOWER&timeIntervals=${timeIntervals}`,
      },
      {
        name: 'trend + timeGranularityType',
        url: `https://api.linkedin.com/rest/dmaOrganizationalPageEdgeAnalytics?q=trend&organizationalPage=${organizationalPageUrn}&analyticsType=FOLLOWER&timeIntervals=${timeIntervalsWithGranularity}`,
      },
      {
        name: 'dimension + dimensionType=REGION_GEO',
        url: `https://api.linkedin.com/rest/dmaOrganizationalPageEdgeAnalytics?q=dimension&organizationalPage=${organizationalPageUrn}&analyticsType=FOLLOWER&dimensionType=REGION_GEO`,
      },
    ];

    // Docs explicitly say: to find which pages you can actually query
    // analytics for, check dmaOrganizationAuthorizations for the
    // VISITOR_ANALYTICS_READ authorization action. Do that check first -
    // the identical ILLEGAL_ARGUMENT across every param combination
    // suggests a missing per-action authorization, not a syntax issue.
    let authorizationCheck = null;
    try {
      const authRes = await fetch(
        `https://api.linkedin.com/rest/dmaOrganizationAuthorizations?ids=List(${organizationalPageUrn})`,
        { headers: baseHeaders(accessToken) }
      );
      authorizationCheck = { status: authRes.status, body: await authRes.json() };
    } catch (err) {
      authorizationCheck = { error: err.message };
    }

    const followerVariantResults = [];
    for (const variant of followerVariants) {
      try {
        const r = await fetch(variant.url, { headers: baseHeaders(accessToken) });
        const d = await r.json();
        followerVariantResults.push({ name: variant.name, url: variant.url, status: r.status, body: d });

        if (r.ok && Array.isArray(d.elements) && followers === 0) {
          followers = d.elements.reduce((sum, el) => {
            const v = el.value?.typeSpecificValue?.followerEdgeAnalyticsValue;
            return sum + (v?.organicValue || 0) + (v?.sponsoredValue || 0);
          }, 0);
        }
      } catch (err) {
        followerVariantResults.push({ name: variant.name, url: variant.url, error: err.message });
      }
    }

    // Step 3: post engagement/impressions via content analytics (postGestures).
    try {
      const contentRes = await fetch(
        `https://api.linkedin.com/rest/dmaOrganizationalPageContentAnalytics?q=postGestures&organizationalPage=${organizationalPageUrn}`,
        { headers: baseHeaders(accessToken) }
      );
      const contentData = await contentRes.json();
      if (Array.isArray(contentData.elements) && contentData.elements.length > 0) {
        const totalImpressions = contentData.elements.reduce((sum, el) => sum + (el.impressionCount || 0), 0);
        const totalEngagements = contentData.elements.reduce((sum, el) =>
          sum + (el.likeCount || 0) + (el.commentCount || 0) + (el.shareCount || 0) + (el.clickCount || 0), 0);
        monthlyImpressions = totalImpressions;
        if (totalImpressions > 0) {
          engagementRate = ((totalEngagements / totalImpressions) * 100).toFixed(1) + '%';
        }
        topPostReach = Math.max(...contentData.elements.map((el) => el.impressionCount || 0), 0);
      }
    } catch (contentErr) {
      console.log('[LinkedIn] Content analytics unavailable:', contentErr.message);
    }

    res.status(200).json({
      success: true,
      message: 'LinkedIn Analytics - Available Metrics',
      debug: {
        organizationalPageUrn,
        authorizationCheck,
        followerVariantResults,
      },
      summary: {
        followers,
        monthlyImpressions,
        engagementRate,
        topPostReach,
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
