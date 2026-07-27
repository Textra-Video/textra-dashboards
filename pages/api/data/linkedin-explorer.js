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
          'Accept': 'application/json',
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

    // organizationalPage/pageEntity/followee ALL rejected urn:li:organization:X
    // as an invalid/wrong-type URN - this whole DMA API family doesn't
    // recognize that identifier at all. Query dmaOrganizationAcls (the
    // roleAssignee finder returns the orgs THIS token's member actually
    // administers) to discover the real identifiers this API expects,
    // rather than guessing another URN prefix blind.
    let organizationalPageUrn = null;
    try {
      const aclsRes = await fetch(
        `https://api.linkedin.com/rest/dmaOrganizationAcls?q=roleAssignee`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
            'LinkedIn-Version': '202605',
            'X-Restli-Protocol-Version': '2.0.0',
          },
        }
      );
      const aclsText = await aclsRes.text();
      debugResponses.push({ endpoint: 'dmaOrganizationAcls (roleAssignee)', status: aclsRes.status, fullBody: aclsText });
      console.log(`[LinkedIn] dmaOrganizationAcls status ${aclsRes.status}: ${aclsText}`);

      if (aclsRes.ok) {
        const aclsData = JSON.parse(aclsText);
        organizationalPageUrn = aclsData.elements?.[0]?.organization || aclsData.elements?.[0]?.organizationalTarget || null;
      }
    } catch (err) {
      debugResponses.push({ endpoint: 'dmaOrganizationAcls (roleAssignee)', error: err.message });
    }

    // Every YYYYMM version from 2023-2026 was rejected as NONEXISTENT_VERSION.
    // Confirmed: this app's ONLY product is "Pages Data Portability API"
    // (Standard Tier) - the dma* endpoints ARE the correct/only product.
    // A version window that rejects 2.5 years of monthly values means this
    // product likely doesn't use the standard rolling LinkedIn-Version scheme
    // at all. Test omitting the header entirely as the decisive check.
    const probeUrl = `https://api.linkedin.com/rest/dmaOrganizationalPageEdgeAnalytics?q=dimension&organizationalPage=${organizationUrn}`;

    let workingVersion = null;
    let noVersionWorked = false;

    try {
      const res = await fetch(probeUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
      const text = await res.text();
      debugResponses.push({ endpoint: 'no LinkedIn-Version header', status: res.status, fullBody: text });
      console.log(`[LinkedIn] no version header status ${res.status}: ${text}`);
      // Only a genuine 2xx counts as "worked" - 400/426 are both rejections
      if (res.ok) noVersionWorked = true;
    } catch (err) {
      debugResponses.push({ endpoint: 'no LinkedIn-Version header', error: err.message });
    }

    if (!noVersionWorked) {
      // Prior probes covered 202312-202506, all rejected as NONEXISTENT_VERSION.
      // Today's real date is 2026-07-27, so also test the actual current
      // window - the product may have GA'd more recently than assumed.
      const versionCandidates = [
        '202607', '202606', '202605', '202604', '202603', '202602', '202601',
        '202512', '202511', '202510',
      ];
      for (const version of versionCandidates) {
        try {
          const res = await fetch(probeUrl, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json',
              'LinkedIn-Version': version,
              'X-Restli-Protocol-Version': '2.0.0',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
          });
          const text = await res.text();
          debugResponses.push({ endpoint: `version probe ${version}`, status: res.status, fullBody: text });
          console.log(`[LinkedIn] version ${version} status ${res.status}: ${text}`);

          // Stop at the first version that isn't rejected as nonexistent
          if (res.status !== 426) {
            workingVersion = version;
            break;
          }
        } catch (err) {
          debugResponses.push({ endpoint: `version probe ${version}`, error: err.message });
        }
      }
    }

    if (workingVersion || noVersionWorked) {
      console.log(`[LinkedIn] Proceeding with version: ${workingVersion || '(none/omitted)'}. Querying real endpoints...`);

      // The error echoed urn:li:organization:108355800 back unmangled (not an
      // encoding issue) - this is a URN TYPE mismatch. The field is literally
      // named "organizationalPage", distinct from "organization" (which
      // deserialized fine in dmaOrganizationAcls). Try the organizationalPage
      // URN namespace with the same numeric ID.
      const orgId = organizationUrn.split(':').pop();
      const orgPageUrn = organizationalPageUrn || `urn:li:organizationalPage:${orgId}`;

      // Isolate the real cause with a direct comparison matrix: URN type
      // (organization vs organizationalPage) x extra finder param, instead
      // of guessing forward again on an ambiguous generic error.
      const dmaQueries = [
        {
          name: 'dimension + org URN (no extra param)',
          url: `https://api.linkedin.com/rest/dmaOrganizationalPageEdgeAnalytics?q=dimension&organizationalPage=${organizationUrn}`,
        },
        {
          name: 'dimension + organizationalPage URN (no extra param)',
          url: `https://api.linkedin.com/rest/dmaOrganizationalPageEdgeAnalytics?q=dimension&organizationalPage=${orgPageUrn}`,
        },
        {
          name: 'dimension + org URN + edgeType=FOLLOWERSHIP',
          url: `https://api.linkedin.com/rest/dmaOrganizationalPageEdgeAnalytics?q=dimension&organizationalPage=${organizationUrn}&edgeType=FOLLOWERSHIP`,
        },
        {
          name: 'trend + org URN + edgeType=FOLLOWERSHIP',
          url: `https://api.linkedin.com/rest/dmaOrganizationalPageEdgeAnalytics?q=trend&organizationalPage=${organizationUrn}&edgeType=FOLLOWERSHIP`,
        },
        {
          name: 'followee + org URN',
          url: `https://api.linkedin.com/rest/dmaOrganizationalPageFollows?q=followee&followee=${organizationUrn}`,
        },
        {
          name: 'followee + organizationalPage URN',
          url: `https://api.linkedin.com/rest/dmaOrganizationalPageFollows?q=followee&followee=${orgPageUrn}`,
        },
      ];

      for (const query of dmaQueries) {
        try {
          const headers = {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          };
          if (workingVersion) headers['LinkedIn-Version'] = workingVersion;

          const res = await fetch(query.url, { headers });

          const text = await res.text();
          let data = {};
          try { data = JSON.parse(text); } catch { /* non-JSON body */ }

          console.log(`[LinkedIn] ${query.name} status: ${res.status}, body: ${text}`);

          debugResponses.push({
            endpoint: query.name,
            status: res.status,
            fullBody: text,
          });

          if (res.ok && Array.isArray(data.elements) && data.elements.length > 0) {
            const element = data.elements[0];

            if (element.followerCounts) {
              followers = (element.followerCounts.organicFollowerCount || 0) + (element.followerCounts.paidFollowerCount || 0);
            }
            if (element.totalShareStatistics) {
              monthlyImpressions = element.totalShareStatistics.impressionCount || monthlyImpressions;
            }
            if (element.followerCount) followers = element.followerCount;
            if (element.impressionCount) monthlyImpressions = element.impressionCount;
          }
        } catch (queryErr) {
          console.log(`[LinkedIn] ${query.name} error:`, queryErr.message);
          debugResponses.push({ endpoint: query.name, error: queryErr.message });
        }
      }
    } else {
      console.log('[LinkedIn] No working version found among candidates');
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
