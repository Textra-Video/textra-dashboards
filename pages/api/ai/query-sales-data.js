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

  let context = '### SUMMARY METRICS\n';

  // Extract metrics from top-level data object
  if (data.totalPipeline !== undefined && data.totalPipeline !== null)
    context += `Total Pipeline: £${data.totalPipeline}\n`;
  if (data.confirmedBookings !== undefined && data.confirmedBookings !== null)
    context += `Confirmed Bookings (all-time): £${data.confirmedBookings}\n`;
  if (data.thisMonthClose !== undefined && data.thisMonthClose !== null)
    context += `This Month Close (forecast): £${data.thisMonthClose}\n`;
  if (data.monthlyRunRate !== undefined && data.monthlyRunRate !== null)
    context += `Monthly Run Rate: £${data.monthlyRunRate}\n`;
  if (data.avgSalesCycle !== undefined && data.avgSalesCycle !== null)
    context += `Average Sales Cycle: ${data.avgSalesCycle}d\n`;

  // Stage breakdown
  if (data.byStage && typeof data.byStage === 'object' && Object.keys(data.byStage).length > 0) {
    context += '\n### DEALS BY STAGE\n';
    Object.entries(data.byStage).forEach(([stage, value]) => {
      context += `${stage}: £${value}\n`;
    });
  }

  // Source breakdown
  if (data.bySource && typeof data.bySource === 'object' && Object.keys(data.bySource).length > 0) {
    context += '\n### DEALS BY SOURCE\n';
    Object.entries(data.bySource).forEach(([source, value]) => {
      context += `${source}: £${value}\n`;
    });
  }

  // Size breakdown
  if (data.bySize && typeof data.bySize === 'object') {
    context += '\n### DEALS BY SIZE\n';
    if (data.bySize.micro !== undefined) context += `Micro (<£10k): £${data.bySize.micro}\n`;
    if (data.bySize.sme !== undefined) context += `SME (£10-50k): £${data.bySize.sme}\n`;
    if (data.bySize.enterprise !== undefined) context += `Enterprise (>£50k): £${data.bySize.enterprise}\n`;
  }

  // Recent deals
  if (data.deals && Array.isArray(data.deals) && data.deals.length > 0) {
    context += '\n### RECENT DEALS\n';
    data.deals.slice(0, 5).forEach(deal => {
      context += `${deal.name}: £${deal.value} (${deal.stage})\n`;
    });
  }

  return context;
}
