export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(401).json({
      error: 'Groq API not configured',
      message: 'Missing GROQ_API_KEY environment variable',
      setupInstructions: {
        step1: 'Go to https://console.groq.com/keys',
        step2: 'Create an API key',
        step3: 'Add to environment variable: GROQ_API_KEY',
        note: 'Groq offers free tier with very fast inference',
      },
    });
  }

  try {
    const { query, dashboardData } = req.body;

    if (!query || !dashboardData) {
      return res.status(400).json({ error: 'Missing query or dashboardData' });
    }

    // Format the dashboard data for the prompt
    const dataContext = formatSalesData(dashboardData);

    const prompt = `You are a sales analytics assistant. Analyze this sales pipeline data and answer the user's question clearly and concisely.

SALES DATA:
${dataContext}

USER QUESTION: ${query}

Provide a direct, actionable answer. If relevant, cite specific numbers from the data. Keep response under 200 words unless the user asks for detailed analysis.`;

    // Models to try with Groq (in priority order)
    const modelsToTry = [
      'llama-3.3-70b-versatile',
      'llama-3.2-90b-vision-preview',
      'gemma2-9b-it',
    ];

    let lastError;
    console.log('Attempting Groq with models:', modelsToTry);

    for (const modelName of modelsToTry) {
      try {
        console.log('Trying Groq model:', modelName);

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelName,
            messages: [
              {
                role: 'system',
                content: 'You are a sales analytics assistant. Provide direct, actionable answers with specific numbers from the data when relevant.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            max_tokens: 500,
            temperature: 0.7,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          const error = new Error(data.error?.message || 'Groq API error');
          error.status = response.status;
          error.data = data;
          throw error;
        }

        const responseText = data.choices?.[0]?.message?.content || 'No response from model';

        console.log('Success with Groq model:', modelName);
        return res.status(200).json({
          success: true,
          answer: responseText,
          timestamp: new Date().toISOString(),
          model: modelName,
          provider: 'groq',
        });
      } catch (err) {
        lastError = err;
        const errorMessage = (err.message || '').toLowerCase();
        const errorString = JSON.stringify(err).toLowerCase();

        // Check for rate limit errors
        const isRateLimitError =
          err.status === 429 ||
          errorMessage.includes('429') ||
          errorMessage.includes('rate limit') ||
          errorMessage.includes('too many requests') ||
          errorString.includes('rate_limit');

        console.error(`Groq model ${modelName} error:`, {
          status: err.status,
          message: err.message,
          isRateLimitError,
        });

        if (isRateLimitError) {
          console.warn(`Model ${modelName} hit rate limit, trying next model...`);
          continue; // Try next model
        } else {
          // Other errors should stop retrying
          console.error(`Model ${modelName} failed with non-rate-limit error, stopping retry`);
          throw err;
        }
      }
    }

    // If we get here, all models have rate limit issues
    if (lastError && lastError.status === 429) {
      console.error('All Groq models have hit rate limits');
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Groq API rate limit exceeded. Please try again in a few moments.',
        retryAfter: 60,
      });
    }

    // Unexpected failure
    throw lastError || new Error('All Groq models exhausted');
  } catch (err) {
    console.error('Groq query error:', err);
    return res.status(500).json({
      error: 'Failed to process query',
      message: err.message,
    });
  }
}

function formatSalesData(data) {
  if (!data) return 'No data available';

  const {
    summary = {},
    deals = [],
    stageBreakdown = [],
    sourceBreakdown = [],
    sizeBreakdown = [],
  } = data;

  let context = '### SUMMARY METRICS\n';
  if (summary.totalPipeline)
    context += `Total Pipeline: £${summary.totalPipeline}\n`;
  if (summary.confirmedBookings)
    context += `Confirmed Bookings (all-time): £${summary.confirmedBookings}\n`;
  if (summary.thisMonthClose)
    context += `This Month Close (forecast): £${summary.thisMonthClose}\n`;
  if (summary.monthlyRunRate)
    context += `Monthly Run Rate: £${summary.monthlyRunRate}\n`;
  if (summary.avgSalesCycle)
    context += `Average Sales Cycle: ${summary.avgSalesCycle}\n`;

  if (stageBreakdown && stageBreakdown.length > 0) {
    context += '\n### DEALS BY STAGE\n';
    stageBreakdown.forEach(s => {
      context += `${s.label}: £${s.value || 0}\n`;
    });
  }

  if (sourceBreakdown && sourceBreakdown.length > 0) {
    context += '\n### DEALS BY SOURCE\n';
    sourceBreakdown.forEach(s => {
      context += `${s.label}: £${s.value || 0}\n`;
    });
  }

  if (sizeBreakdown && sizeBreakdown.length > 0) {
    context += '\n### DEALS BY SIZE\n';
    sizeBreakdown.forEach(s => {
      context += `${s.label}: £${s.value || 0}\n`;
    });
  }

  if (deals && deals.length > 0 && deals.length <= 10) {
    context += '\n### RECENT DEALS\n';
    deals.slice(0, 5).forEach(deal => {
      context += `${deal.name}: £${deal.amount} (${deal.stage})\n`;
    });
  }

  return context;
}
