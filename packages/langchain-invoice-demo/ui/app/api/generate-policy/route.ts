import { NextRequest, NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SYSTEM_PROMPT = `You are a policy generator for AgentOAuth, a system for AI agent authorization.

Convert the user's natural language description into a valid pol.v0.2 JSON policy.

Policy Structure:
{
  "version": "pol.v0.2",
  "id": "pol_{category}_{random}",
  "actions": ["payments.send"],  // Always use this for payment policies
  "resources": [
    {
      "type": "merchant",
      "match": { "ids": ["airbnb", "expedia", "uber"] }  // Extract from user input
    }
  ],
  "limits": {
    "per_txn": { "amount": 500, "currency": "USD" },  // Extract from user input
    "per_period": { "amount": 2000, "currency": "USD", "period": "week" }  // Extract from user input
  },
  "strict": true,
  "meta": {
    "note": "User-friendly description",
    "created": "ISO 8601 timestamp"
  }
}

Rules:
1. Generate a unique policy ID using the format: pol_{category}_{8_random_hex}
2. Extract spending limits from the user's description
3. Extract merchant names (lowercase, no spaces)
4. Default to "week" period if not specified
5. Always use "USD" currency unless specified otherwise
6. Always set strict: true
7. Add helpful metadata explaining the policy

Return ONLY the JSON policy object, no additional text.`;

export async function POST(request: NextRequest) {
  try {
    // Validate environment
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        error: 'OPENAI_API_KEY not configured',
        help: 'Add your OpenAI API key to .env file'
      }, { status: 500 });
    }
    
    const { description } = await request.json();
    
    if (!description || typeof description !== 'string') {
      return NextResponse.json({
        error: 'Description is required'
      }, { status: 400 });
    }
    
    // Call GPT-4 with structured output
    const model = new ChatOpenAI({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      temperature: 0
    });
    
    const result = await model.invoke([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: description }
    ]);
    
    // Parse the response
    let policy;
    try {
      const content = result.content.toString();
      // Remove markdown code blocks if present
      const jsonContent = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      policy = JSON.parse(jsonContent);
    } catch (parseError) {
      return NextResponse.json({
        error: 'Failed to parse GPT-4 response',
        details: parseError.message,
        raw_response: result.content.toString()
      }, { status: 500 });
    }
    
    // Validate required fields
    if (!policy.version || policy.version !== 'pol.v0.2') {
      policy.version = 'pol.v0.2';
    }
    
    if (!policy.id) {
      policy.id = `pol_ai_${crypto.randomBytes(8).toString('hex')}`;
    }
    
    if (!policy.actions || !Array.isArray(policy.actions)) {
      policy.actions = ['payments.send'];
    }
    
    if (!policy.limits) {
      return NextResponse.json({
        error: 'Generated policy missing limits',
        policy
      }, { status: 500 });
    }
    
    // Add metadata
    if (!policy.meta) {
      policy.meta = {};
    }
    policy.meta.created = new Date().toISOString();
    policy.meta.generated_by = 'AI';
    policy.meta.user_description = description;
    
    return NextResponse.json(policy);
    
  } catch (error) {
    console.error('Policy generation error:', error);
    return NextResponse.json({
      error: 'Failed to generate policy',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

