import { NextRequest } from 'next/server';
import { runAgent, type AgentEvent } from '@/lib/agent-runner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Validate environment
  if (!process.env.STRIPE_SECRET_KEY) {
    return new Response(JSON.stringify({
      error: 'STRIPE_SECRET_KEY not configured',
      help: 'Add your Stripe test key to .env file'
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  if (!process.env.OPENAI_API_KEY) {
    return new Response(JSON.stringify({
      error: 'OPENAI_API_KEY not configured',
      help: 'Add your OpenAI API key to .env file'
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Get policy from request body
  const { policy } = await request.json();
  
  if (!policy) {
    return new Response(JSON.stringify({
      error: 'Policy is required',
      help: 'Generate a policy first using the AI policy generator'
    }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Create a TransformStream to send Server-Sent Events
  const encoder = new TextEncoder();
  
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  
  // Function to send SSE events
  const sendEvent = async (event: AgentEvent) => {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    await writer.write(encoder.encode(data));
  };
  
  // Run agent in the background
  (async () => {
    try {
      await runAgent(policy, sendEvent);
    } catch (error) {
      await sendEvent({
        type: 'error',
        message: error instanceof Error ? error.message : 'Processing failed'
      });
    } finally {
      await writer.close();
    }
  })();
  
  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

