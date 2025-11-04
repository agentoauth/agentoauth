import { NextRequest } from 'next/server';
import { runAgent, type AgentEvent } from '@/lib/agent-runner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
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
      await runAgent(sendEvent);
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

