'use client';

import { useState } from 'react';
import { Play, RotateCcw, ExternalLink } from 'lucide-react';
import { InvoiceTable, type Invoice } from '@/components/InvoiceTable';
import { PolicyCard } from '@/components/PolicyCard';
import { LogPanel, type LogEntry } from '@/components/LogPanel';

// Initial invoice data
const INITIAL_INVOICES: Invoice[] = [
  {
    invoice_id: 'inv_001',
    merchant: 'airbnb',
    amount: 300,
    currency: 'USD',
    description: 'Hotel reservation - San Francisco',
    status: 'pending'
  },
  {
    invoice_id: 'inv_002',
    merchant: 'expedia',
    amount: 700,
    currency: 'USD',
    description: 'Flight tickets - NYC to SFO',
    status: 'pending'
  },
  {
    invoice_id: 'inv_003',
    merchant: 'uber',
    amount: 150,
    currency: 'USD',
    description: 'Airport transportation',
    status: 'pending'
  }
];

const DEMO_POLICY = {
  id: 'pol_travel_demo',
  limits: {
    per_txn: { amount: 500, currency: 'USD' },
    per_period: { amount: 2000, currency: 'USD', period: 'week' }
  },
  resources: [
    { type: 'merchant', match: { ids: ['airbnb', 'expedia', 'uber'] } }
  ]
};

export default function DashboardPage() {
  const [invoices, setInvoices] = useState<Invoice[]>(INITIAL_INVOICES);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [processing, setProcessing] = useState(false);
  
  const addLog = (type: LogEntry['type'], message: string) => {
    setLogs(prev => [...prev, { type, message, timestamp: Date.now() }]);
  };
  
  const updateInvoiceStatus = (id: string, updates: Partial<Invoice>) => {
    setInvoices(prev => prev.map(inv => 
      inv.invoice_id === id ? { ...inv, ...updates } : inv
    ));
  };
  
  const handleStartProcessing = async () => {
    setProcessing(true);
    setLogs([]);
    
    // Reset invoices
    setInvoices(INITIAL_INVOICES);
    
    addLog('info', '🚀 Starting invoice processing...');
    
    try {
      // Call the processing API (Server-Sent Events)
      const response = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error('Failed to start processing');
      }
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) {
        throw new Error('No response body');
      }
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');
        
        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;
          
          try {
            const data = JSON.parse(line.slice(6));
            
            switch (data.type) {
              case 'log':
                addLog(data.level || 'info', data.message);
                break;
                
              case 'invoice_start':
                updateInvoiceStatus(data.invoice_id, { status: 'verifying' });
                addLog('info', `🔍 Processing ${data.invoice_id}...`);
                break;
                
              case 'invoice_complete':
                updateInvoiceStatus(data.invoice_id, {
                  status: data.status === 'PAID' ? 'paid' : 'denied',
                  receipt_id: data.receipt_id,
                  reason: data.reason,
                  stripe_payment_id: data.stripe_payment_id
                });
                
                if (data.status === 'PAID') {
                  addLog('success', `✅ ${data.invoice_id} paid ($${data.amount})`);
                } else {
                  addLog('error', `❌ ${data.invoice_id} denied: ${data.reason}`);
                }
                break;
                
              case 'complete':
                addLog('success', `🎉 Complete: ${data.paid} paid, ${data.denied} denied`);
                break;
                
              case 'error':
                addLog('error', `❌ Error: ${data.message}`);
                break;
            }
          } catch (e) {
            console.error('Failed to parse SSE data:', e);
          }
        }
      }
    } catch (error) {
      addLog('error', `Failed to process: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };
  
  const handleReset = () => {
    setInvoices(INITIAL_INVOICES);
    setLogs([]);
  };
  
  const handleRowClick = (invoice: Invoice) => {
    if (invoice.receipt_id) {
      window.open(`https://verifier.agentoauth.org/receipts/${invoice.receipt_id}`, '_blank');
    }
  };
  
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-white">
          <h1 className="text-4xl font-bold mb-2">
            🤖 AgentOAuth Invoice Payer
          </h1>
          <p className="text-primary-100 text-lg">
            Watch an AI agent autonomously pay invoices with verifiable policy enforcement
          </p>
        </div>
        
        {/* Policy Card */}
        <PolicyCard policy={DEMO_POLICY} />
        
        {/* Control Buttons */}
        <div className="flex gap-4">
          <button
            onClick={handleStartProcessing}
            disabled={processing}
            className={`
              flex items-center gap-2 px-6 py-3 rounded-lg font-semibold
              transition-all duration-200 shadow-lg
              ${processing 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-green-600 hover:bg-green-700 hover:shadow-xl active:scale-95'
              }
              text-white
            `}
          >
            <Play className="w-5 h-5" />
            {processing ? 'Processing...' : 'Start Processing'}
          </button>
          
          <button
            onClick={handleReset}
            disabled={processing}
            className="
              flex items-center gap-2 px-6 py-3 rounded-lg font-semibold
              bg-white text-gray-700 hover:bg-gray-50
              border-2 border-gray-300
              transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            <RotateCcw className="w-5 h-5" />
            Reset
          </button>
          
          <a
            href="https://dashboard.stripe.com/test/payments"
            target="_blank"
            rel="noopener noreferrer"
            className="
              flex items-center gap-2 px-6 py-3 rounded-lg font-semibold
              bg-primary-600 hover:bg-primary-700 text-white
              transition-all duration-200 shadow-lg hover:shadow-xl
              ml-auto
            "
          >
            View Stripe Dashboard
            <ExternalLink className="w-5 h-5" />
          </a>
        </div>
        
        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Invoice Table */}
          <div className="lg:col-span-2">
            <InvoiceTable invoices={invoices} onRowClick={handleRowClick} />
          </div>
          
          {/* Log Panel */}
          <div className="lg:col-span-1">
            <LogPanel logs={logs} />
          </div>
        </div>
        
        {/* Footer */}
        <div className="text-center text-white/80 text-sm">
          <p>
            Powered by{' '}
            <a 
              href="https://verifier.agentoauth.org/docs" 
              target="_blank"
              rel="noopener noreferrer"
              className="text-white font-semibold hover:underline"
            >
              AgentOAuth
            </a>
            {' '}×{' '}
            <a 
              href="https://www.langchain.com" 
              target="_blank"
              rel="noopener noreferrer"
              className="text-white font-semibold hover:underline"
            >
              LangChain
            </a>
            {' '}×{' '}
            <a 
              href="https://stripe.com" 
              target="_blank"
              rel="noopener noreferrer"
              className="text-white font-semibold hover:underline"
            >
              Stripe
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

