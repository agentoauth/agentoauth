'use client';

import { useState } from 'react';
import { Play, RotateCcw, ExternalLink, Sparkles, ChevronDown, ChevronUp, Fingerprint } from 'lucide-react';
import { InvoiceTable, type Invoice } from '@/components/InvoiceTable';
import { PolicyCard } from '@/components/PolicyCard';
import { LogPanel, type LogEntry } from '@/components/LogPanel';
import { FlowProgressBar } from '@/components/FlowProgressBar';
import { SignatureExplainerModal } from '@/components/SignatureExplainerModal';
import { IntentApprover } from '@/components/IntentApprover';
import type { IntentV0 } from '@agentoauth/sdk/browser';

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

// Example policy prompts
const EXAMPLE_PROMPTS = [
  "Travel expenses: max $500 per booking, $2000/week, only Airbnb, Expedia, Uber",
  "SaaS subscriptions: max $100/month per service, only Stripe, AWS, Vercel",
  "Team lunch budget: max $50 per person, $500/week, only Uber Eats, DoorDash"
];

export default function DashboardPage() {
  const [invoices, setInvoices] = useState<Invoice[]>(INITIAL_INVOICES);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [processing, setProcessing] = useState(false);
  
  // Policy generation state
  const [policyInput, setPolicyInput] = useState('');
  const [generatedPolicy, setGeneratedPolicy] = useState<any>(null);
  const [generatingPolicy, setGeneratingPolicy] = useState(false);
  const [showExamples, setShowExamples] = useState(true);
  
  // Intent approval state
  const [userIntent, setUserIntent] = useState<IntentV0 | null>(null);
  const [showIntentApprover, setShowIntentApprover] = useState(false);
  const [simulateExpired, setSimulateExpired] = useState(false);
  
  // Flow tracking
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  
  const addLog = (type: LogEntry['type'], message: string) => {
    setLogs(prev => [...prev, { type, message, timestamp: Date.now() }]);
  };
  
  const updateInvoiceStatus = (id: string, updates: Partial<Invoice>) => {
    setInvoices(prev => prev.map(inv => 
      inv.invoice_id === id ? { ...inv, ...updates } : inv
    ));
  };
  
  const handleGeneratePolicy = async () => {
    if (!policyInput.trim()) {
      addLog('warning', '⚠️ Please enter a policy description');
      return;
    }
    
    setCurrentStep('ai');
    setGeneratingPolicy(true);
    addLog('info', '🤖 Asking GPT-4 to generate policy...');
    
    try {
      const response = await fetch('/api/generate-policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: policyInput })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate policy');
      }
      
      const policy = await response.json();
      setGeneratedPolicy(policy);
      setCompletedSteps(['input', 'ai']);
      setCurrentStep(null);
      addLog('success', `✅ Policy generated: ${policy.id}`);
      
      // Auto-show intent approver after policy generation
      setShowIntentApprover(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog('error', `❌ Failed to generate policy: ${errorMessage}`);
      setCurrentStep(null);
    } finally {
      setGeneratingPolicy(false);
    }
  };
  
  const handleIntentApproved = (intent: IntentV0) => {
    // Handle expired simulation
    if (simulateExpired) {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      intent.valid_until = yesterday.toISOString();
      addLog('warning', '⚠️ Simulating expired intent (for demo)');
    }
    
    setUserIntent(intent);
    setShowIntentApprover(false);
    setCompletedSteps(prev => [...prev, 'approval']);
    addLog('success', `✅ Passkey approval granted until ${new Date(intent.valid_until).toLocaleDateString()}`);
  };
  
  const handleIntentCancelled = () => {
    setShowIntentApprover(false);
    addLog('info', 'ℹ️ Passkey approval skipped - continuing without intent (v0.2 mode)');
  };
  
  const handleStartProcessing = async () => {
    if (!generatedPolicy) {
      addLog('warning', '⚠️ Please generate a policy first');
      return;
    }
    setProcessing(true);
    setLogs([]);
    setCurrentStep('signing');
    
    // Reset invoices
    setInvoices(INITIAL_INVOICES);
    
    addLog('info', '🚀 Starting invoice processing...');
    
    // Log intent status
    if (userIntent) {
      addLog('info', `🔐 Using passkey approval (expires: ${new Date(userIntent.valid_until).toLocaleDateString()})`);
    } else {
      addLog('info', 'ℹ️ Running in basic mode (no passkey approval)');
    }
    
    try {
      // Call the processing API (Server-Sent Events)
      const response = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          policy: generatedPolicy,
          intent: userIntent // Pass intent to backend
        })
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
                // Track flow steps based on log messages
                if (data.message?.includes('Consent token issued')) {
                  setCompletedSteps(prev => [...prev, 'signing']);
                  setCurrentStep('verification');
                }
                break;
                
              case 'invoice_start':
                updateInvoiceStatus(data.invoice_id, { status: 'verifying' });
                addLog('info', `🔍 Processing ${data.invoice_id}...`);
                if (!completedSteps.includes('verification')) {
                  setCurrentStep('verification');
                }
                break;
                
              case 'invoice_complete':
                updateInvoiceStatus(data.invoice_id, {
                  status: data.status === 'PAID' ? 'paid' : 'denied',
                  receipt_id: data.receipt_id,
                  reason: data.reason,
                  stripe_payment_id: data.stripe_payment_id
                });
                
                if (!completedSteps.includes('verification')) {
                  setCompletedSteps(prev => [...prev, 'verification']);
                }
                setCurrentStep('payment');
                
                if (data.status === 'PAID') {
                  addLog('success', `✅ ${data.invoice_id} paid ($${data.amount})`);
                } else {
                  addLog('error', `❌ ${data.invoice_id} denied: ${data.reason}`);
                }
                break;
                
              case 'complete':
                addLog('success', `🎉 Complete: ${data.paid} paid, ${data.denied} denied`);
                setCompletedSteps(prev => [...prev, 'payment']);
                setCurrentStep(null);
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog('error', `Failed to process: ${errorMessage}`);
    } finally {
      setProcessing(false);
    }
  };
  
  const handleReset = () => {
    setInvoices(INITIAL_INVOICES);
    setLogs([]);
    setGeneratedPolicy(null);
    setPolicyInput('');
    setUserIntent(null);
    setShowIntentApprover(false);
    setSimulateExpired(false);
    setCompletedSteps([]);
    setCurrentStep(null);
  };
  
  const handleRowClick = (invoice: Invoice) => {
    if (invoice.receipt_id) {
      window.open(`https://verifier.agentoauth.org/receipts/${invoice.receipt_id}`, '_blank');
    }
  };
  
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="text-white">
          <h1 className="text-4xl font-bold mb-2">
            🤖 AgentOAuth Invoice Payer
          </h1>
          <p className="text-primary-100 text-lg">
            Watch an AI agent autonomously pay invoices with verifiable policy enforcement
          </p>
        </div>
        
        {/* Compact Progress Bar */}
        <FlowProgressBar 
          completedSteps={completedSteps} 
          currentStep={currentStep}
          onSignatureClick={() => setShowSignatureModal(true)}
        />
        
        {/* Signature Explainer Modal */}
        <SignatureExplainerModal 
          isOpen={showSignatureModal}
          onClose={() => setShowSignatureModal(false)}
        />
        
        {/* Split View Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[35%_65%] gap-4">
          {/* Left Column: Policy Input & Generation */}
          <div className="space-y-4 max-h-[calc(100vh-350px)] overflow-y-auto">
            {/* Policy Input */}
            <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary-600" />
              Describe Your Policy
            </h2>
            
            <textarea
              value={policyInput}
              onChange={(e) => setPolicyInput(e.target.value)}
              placeholder="Example: Travel expenses for my sales team - max $1000 per trip, $5000/month total, only for Airbnb, Uber, and Delta"
              className="w-full h-32 p-4 border-2 border-gray-300 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-200 resize-none"
              disabled={generatingPolicy}
            />
            
            {/* Example Prompts */}
            <div className="mt-4">
              <button
                onClick={() => setShowExamples(!showExamples)}
                className="text-sm text-primary-600 hover:text-primary-800 flex items-center gap-1"
              >
                {showExamples ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {showExamples ? 'Hide' : 'Show'} example prompts
              </button>
              
              {showExamples && (
                <div className="mt-3 space-y-2">
                  {EXAMPLE_PROMPTS.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => setPolicyInput(prompt)}
                      className="w-full text-left p-3 text-sm bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <button
              onClick={handleGeneratePolicy}
              disabled={generatingPolicy || !policyInput.trim()}
              className={`
                mt-4 w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold
                transition-all duration-200 shadow-lg
                ${generatingPolicy || !policyInput.trim()
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-primary-600 hover:bg-primary-700 hover:shadow-xl active:scale-95'
                }
                text-white
              `}
            >
              <Sparkles className="w-5 h-5" />
              {generatingPolicy ? 'Generating with GPT-4...' : 'Generate Policy'}
            </button>
          </div>
          
            {/* Generated Policy Card */}
            {generatedPolicy && (
              <PolicyCard policy={generatedPolicy} />
            )}
            
            {/* Passkey Approval Section */}
            {generatedPolicy && !userIntent && !processing && (
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                      <Fingerprint className="w-5 h-5 text-purple-700" />
                      Passkey Approval (Optional)
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Add time-bound human approval for stronger security
                    </p>
                  </div>
                  <button
                    onClick={() => setShowIntentApprover(true)}
                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-colors"
                  >
                    Approve with Passkey
                  </button>
                </div>
                
                {/* Simulate Expired Checkbox */}
                <div className="mt-3 pt-3 border-t border-purple-200">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={simulateExpired}
                      onChange={(e) => setSimulateExpired(e.target.checked)}
                      className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <span className="text-gray-700">
                      Simulate expired approval (for demo)
                    </span>
                  </label>
                </div>
              </div>
            )}
            
            {/* Intent Approved Badge */}
            {userIntent && (
              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-800">
                  <Fingerprint className="w-5 h-5" />
                  <strong>Passkey Approved</strong>
                </div>
                <div className="text-sm text-gray-700 mt-1">
                  Valid until: <strong>{new Date(userIntent.valid_until).toLocaleDateString()}</strong>
                  {simulateExpired && <span className="text-red-600 ml-2">(⚠️ Expired - Demo)</span>}
                </div>
              </div>
            )}
            
            {/* Control Buttons */}
            <div className="flex gap-3">
          <button
            onClick={handleStartProcessing}
            disabled={processing || !generatedPolicy}
            className={`
              flex items-center gap-2 px-6 py-3 rounded-lg font-semibold
              transition-all duration-200 shadow-lg
              ${processing || !generatedPolicy
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
                  flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm
                  bg-white text-gray-700 hover:bg-gray-50
                  border-2 border-gray-300
                  transition-all duration-200
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
            </div>
          </div>
          
          {/* Right Column: Invoice Results & Logs */}
          <div className="space-y-4">
            {/* Stripe Dashboard Link */}
            <a
              href="https://dashboard.stripe.com/test/payments"
              target="_blank"
              rel="noopener noreferrer"
              className="
                flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm
                bg-primary-600 hover:bg-primary-700 text-white
                transition-all duration-200 shadow-lg hover:shadow-xl
              "
            >
              View Stripe Dashboard
              <ExternalLink className="w-4 h-4" />
            </a>
            
            {/* Invoice Table */}
            <div className="max-h-[400px] overflow-y-auto">
              <InvoiceTable invoices={invoices} onRowClick={handleRowClick} />
            </div>
            
            {/* Log Panel */}
            <LogPanel logs={logs} className="h-[300px]" />
          </div>
        </div>
        
        {/* Intent Approver Modal */}
        {showIntentApprover && generatedPolicy && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <IntentApprover 
              policy={generatedPolicy}
              onApproved={handleIntentApproved}
              onCancel={handleIntentCancelled}
            />
          </div>
        )}
        
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

