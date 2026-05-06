const Anthropic = require('@anthropic-ai/sdk');

exports.handler = async (event, context) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method Not Allowed' }),
            headers: {
                'Content-Type': 'application/json'
            }
        };
    }

    // Get API key from environment variable
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'API key not configured' }),
            headers: {
                'Content-Type': 'application/json'
            }
        };
    }

    // Initialize Anthropic client
    const anthropic = new Anthropic({
        apiKey: apiKey,
    });

    try {
        // Parse the intake form data from the request body
        const intakeData = JSON.parse(event.body);

        // Craft a detailed prompt for generating the plan
        const prompt = `You are a professional fitness coach and nutritionist. Based on the following client intake data, generate a comprehensive, personalized 12-week training and nutrition plan. The plan should be safe, effective, and tailored to the client's goals, experience level, and any limitations.

Intake Data:
${JSON.stringify(intakeData, null, 2)}

Please structure the plan as follows:
1. Executive Summary: Brief overview of the plan based on their goals and profile
2. Weekly Training Schedule: Detailed workouts for each training day, including exercises, sets, reps, and progression
3. Nutrition Guidelines: Daily calorie targets, macronutrient breakdown, meal timing, and sample meals
4. Progression and Adjustments: How the plan will evolve over 12 weeks
5. Recovery and Monitoring: Tips for recovery, tracking progress, and when to adjust
6. Safety Notes: Any specific considerations based on their health information

Ensure the plan is realistic, sustainable, and motivating. Use clear, actionable language.`;

        // Call Anthropic API
        const response = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 8000,
            messages: [
                { role: 'user', content: prompt }
            ]
        });

        // Return the generated plan
        return {
            statusCode: 200,
            body: response.content[0].text,
            headers: {
                'Content-Type': 'text/plain'
            }
        };

    } catch (error) {
        console.error('Error generating plan:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to generate plan', details: error.message }),
            headers: {
                'Content-Type': 'application/json'
            }
        };
    }
};