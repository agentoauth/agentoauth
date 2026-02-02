import { NextRequest } from 'next/server';
import { runAgent, type AgentEvent } from '@/lib/agent-runner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const mode = body.mode ?? 'payments';

  // Validate environment (Stripe required only for payments mode)
  if (mode === 'payments' && !process.env.STRIPE_SECRET_KEY) {
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
  
  const { policy, intent, claims } = body;

  if (!policy) {
    return new Response(JSON.stringify({
      error: 'Policy is required',
      help: 'Generate a policy first using the AI policy generator'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const sendEvent = async (event: AgentEvent) => {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    await writer.write(encoder.encode(data));
  };

  // In claims mode, ensure policy allows resource id "claims" so verifier accepts
  const policyToUse =
    mode === 'claims' && policy?.resources?.[0]?.match?.ids
      ? {
          ...policy,
          resources: [
            {
              ...policy.resources[0],
              match: {
                ...policy.resources[0].match,
                ids: Array.from(new Set([...policy.resources[0].match.ids, 'claims']))
              }
            }
          ]
        }
      : policy;

  (async () => {
    try {
      await runAgent(policyToUse, sendEvent, { mode: mode ?? 'payments', claims, intent });
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

