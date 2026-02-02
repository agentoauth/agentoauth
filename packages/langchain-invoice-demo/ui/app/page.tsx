'use client';

import { useState, Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Play, RotateCcw, ExternalLink, Sparkles, ChevronDown, ChevronUp, Fingerprint } from 'lucide-react';
import { InvoiceTable, type Invoice } from '@/components/InvoiceTable';
import { ClaimsTable, type Claim, type ClaimDecisionStatus } from '@/components/ClaimsTable';
import { PolicyCard } from '@/components/PolicyCard';
import { LogPanel, type LogEntry } from '@/components/LogPanel';
import { FlowProgressBar } from '@/components/FlowProgressBar';
import { SignatureExplainerModal } from '@/components/SignatureExplainerModal';
import { IntentApprover } from '@/components/IntentApprover';
import { OpenProofPanel, type OpenProofData } from '@/components/OpenProofPanel';
import type { IntentV0 } from '@agentoauth/sdk/browser';

export type DemoMode = 'payments' | 'claims';

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

// Example policy prompts (payments)
const EXAMPLE_PROMPTS = [
  "Travel expenses: max $500 per booking, $2000/week, only Airbnb, Expedia, Uber",
  "SaaS subscriptions: max $100/month per service, only Stripe, AWS, Vercel",
  "Team lunch budget: max $50 per person, $500/week, only Uber Eats, DoorDash"
];

// Example policy prompts (claims mode)
const CLAIMS_EXAMPLE_PROMPTS = [
  "Auto-settle home insurance claims under $1,000 only when coverage is confirmed and documentation is complete.",
  "Require approval for settlements over $1,000",
  "Deny if documentation incomplete",
  "Business hours only"
];

// Initial claims data (claims mode)
const INITIAL_CLAIMS: Claim[] = [
  { claim_id: 'CLM-91823', loss_type: 'Water damage', amount: 742, currency: 'USD', coverage_confirmed: true, docs_complete: true, status: 'pending' },
  { claim_id: 'CLM-91824', loss_type: 'Fire damage', amount: 1700, currency: 'USD', coverage_confirmed: true, docs_complete: true, status: 'pending' },
  { claim_id: 'CLM-91825', loss_type: 'Water damage', amount: 600, currency: 'USD', coverage_confirmed: true, docs_complete: true, status: 'pending' }
];

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen p-8 flex items-center justify-center text-white">Loading...</div>}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const mode: DemoMode = searchParams.get('mode') === 'claims' ? 'claims' : 'payments';

  const setMode = (newMode: DemoMode) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newMode === 'payments') {
      params.delete('mode');
    } else {
      params.set('mode', newMode);
    }
    const q = params.toString();
    router.push(q ? `?${q}` : window.location.pathname);
  };

  const [invoices, setInvoices] = useState<Invoice[]>(INITIAL_INVOICES);
  const [claims, setClaims] = useState<Claim[]>(INITIAL_CLAIMS);
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
  const [openProofData, setOpenProofData] = useState<OpenProofData | null>(null);
  const [showOpenProof, setShowOpenProof] = useState(false);

  // In claims mode, ensure policy includes "claims" so intent and verifier use the same policy hash
  useEffect(() => {
    if (mode !== 'claims' || !generatedPolicy?.resources?.[0]?.match?.ids) return;
    const ids = generatedPolicy.resources[0].match.ids;
    if (Array.isArray(ids) && ids.includes('claims')) return;
    setGeneratedPolicy({
      ...generatedPolicy,
      resources: [
        {
          ...generatedPolicy.resources[0],
          match: {
            ...generatedPolicy.resources[0].match,
            ids: [...ids, 'claims']
          }
        }
      ]
    });
    setUserIntent(null);
  }, [mode, generatedPolicy]);

  const addLog = (type: LogEntry['type'], message: string) => {
    setLogs(prev => [...prev, { type, message, timestamp: Date.now() }]);
  };
  
  const updateInvoiceStatus = (id: string, updates: Partial<Invoice>) => {
    setInvoices(prev => prev.map(inv =>
      inv.invoice_id === id ? { ...inv, ...updates } : inv
    ));
  };

  const updateClaimStatus = (id: string, updates: Partial<Claim>) => {
    setClaims(prev => prev.map(c =>
      c.claim_id === id ? { ...c, ...updates } : c
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
      
      let policy = await response.json();
      // In claims mode, add "claims" to allowed resources before approval so intent binds to the same policy we send to the verifier
      if (mode === 'claims' && policy?.resources?.[0]?.match?.ids) {
        policy = {
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
        };
      }
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
    
    // Reset invoices / claims
    setInvoices(INITIAL_INVOICES);
    setClaims(INITIAL_CLAIMS);

    addLog('info', mode === 'claims' ? '🚀 Starting claims processing...' : '🚀 Starting invoice processing...');
    
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
          intent: userIntent,
          mode,
          ...(mode === 'claims' && { claims })
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
                
              case 'invoice_start': {
                const id = data.invoice_id ?? data.claim_id;
                if (id) {
                  if (mode === 'claims') {
                    updateClaimStatus(id, { status: 'verifying' });
                  } else {
                    updateInvoiceStatus(id, { status: 'verifying' });
                  }
                  addLog('info', `🔍 Processing ${id}...`);
                }
                if (!completedSteps.includes('verification')) {
                  setCurrentStep('verification');
                }
                break;
              }
              case 'invoice_complete':
              case 'claim_complete': {
                const id = data.claim_id ?? data.invoice_id;
                if (!id) break;
                const allowed = data.status === 'PAID' || data.status === 'ALLOW';
                if (mode === 'claims') {
                  updateClaimStatus(id, {
                    status: data.status === 'BLOCKED' ? 'blocked' : allowed ? 'allowed' : 'denied',
                    receipt_id: data.receipt_id,
                    reason: data.reason,
                    context_hash: data.context_hash,
                    context_summary: data.context_summary,
                    decision_notes: data.decision_notes
                  });
                  if (allowed) {
                    addLog('success', `✅ ${id} allowed ($${data.amount ?? 0})`);
                  } else if (data.status === 'BLOCKED') {
                    addLog('warning', `⚠️ ${id} blocked — Authority already consumed`);
                  } else {
                    addLog('error', `❌ ${id} denied: ${data.reason ?? 'Policy check failed'}`);
                  }
                } else {
                  updateInvoiceStatus(id, {
                    status: allowed ? 'paid' : 'denied',
                    receipt_id: data.receipt_id,
                    reason: data.reason,
                    stripe_payment_id: data.stripe_payment_id
                  });
                  if (allowed) {
                    addLog('success', `✅ ${id} paid ($${data.amount})`);
                  } else {
                    addLog('error', `❌ ${id} denied: ${data.reason ?? 'Policy check failed'}`);
                  }
                }
                if (!completedSteps.includes('verification')) {
                  setCompletedSteps(prev => [...prev, 'verification']);
                }
                setCurrentStep('payment');
                break;
              }
                
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
    setClaims(INITIAL_CLAIMS);
    setLogs([]);
    setGeneratedPolicy(null);
    setPolicyInput('');
    setUserIntent(null);
    setShowIntentApprover(false);
    setSimulateExpired(false);
    setCompletedSteps([]);
    setCurrentStep(null);
  };

  const handleClaimRowClick = (claim: Claim) => {
    if (!claim.receipt_id) return;
    setOpenProofData({
      receipt_id: claim.receipt_id,
      decision: claim.status === 'allowed' ? 'ALLOW' : 'DENY',
      decision_notes: claim.decision_notes,
      context_summary: claim.context_summary,
      context_hash: claim.context_hash,
      signature_verified: true,
      policy_id: generatedPolicy?.id ?? undefined,
      intent_approved_at: userIntent?.approved_at ?? undefined,
      intent_reference: userIntent
        ? (userIntent.credential_id ? 'intent_' + userIntent.credential_id.slice(0, 8) : 'intent_present')
        : undefined
    });
    setShowOpenProof(true);
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
            {mode === 'payments' ? '🤖 AgentOAuth — Invoice Payer' : 'Tessra — Automated Claims Authority'}
          </h1>
          <p className="text-primary-100 text-lg mb-4">
            {mode === 'payments'
              ? 'Watch an AI agent autonomously pay invoices with verifiable policy enforcement'
              : 'Prove when an automated system was authorized to settle a claim — even months later'}
          </p>
          {/* Demo Mode Toggle */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-primary-100">Demo Mode:</span>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="demoMode"
                  checked={mode === 'payments'}
                  onChange={() => setMode('payments')}
                  className="w-4 h-4 text-primary-600"
                />
                <span>Payments (Invoice Payer)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="demoMode"
                  checked={mode === 'claims'}
                  onChange={() => setMode('claims')}
                  className="w-4 h-4 text-primary-600"
                />
                <span>Claims Settlement Authority</span>
              </label>
            </div>
          </div>
        </div>
        
        {/* Compact Progress Bar */}
        <FlowProgressBar 
          completedSteps={completedSteps} 
          currentStep={currentStep}
          onSignatureClick={() => setShowSignatureModal(true)}
          mode={mode}
        />
        
        {/* Signature Explainer Modal */}
        <SignatureExplainerModal 
          isOpen={showSignatureModal}
          onClose={() => setShowSignatureModal(false)}
        />

        {/* Open Proof Panel (claims mode) */}
        <OpenProofPanel
          isOpen={showOpenProof}
          onClose={() => { setShowOpenProof(false); setOpenProofData(null); }}
          data={openProofData}
        />
        
        {/* Split View Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[35%_65%] gap-4">
          {/* Left Column: Policy Input & Generation */}
          <div className="space-y-4 max-h-[calc(100vh-350px)] overflow-y-auto">
            {/* Policy Input */}
            <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary-600" />
              {mode === 'payments' ? 'Describe Your Policy' : 'Define Settlement Authority'}
            </h2>
            
            <textarea
              value={policyInput}
              onChange={(e) => setPolicyInput(e.target.value)}
              placeholder={mode === 'payments'
                ? 'Example: Travel expenses for my sales team - max $1000 per trip, $5000/month total, only for Airbnb, Uber, and Delta'
                : 'Example: Auto-settle home insurance claims under $1,000 only when coverage is confirmed and documentation is complete.'}
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
                  {(mode === 'claims' ? CLAIMS_EXAMPLE_PROMPTS : EXAMPLE_PROMPTS).map((prompt, i) => (
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
              <PolicyCard policy={generatedPolicy} mode={mode} />
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
          
          {/* Right Column: Results & Logs */}
          <div className="space-y-4">
            {/* Stripe Dashboard Link (payments mode only) */}
            {mode === 'payments' && (
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
            )}

            {/* Invoice or Claims Table */}
            <div className="max-h-[400px] overflow-y-auto">
              {mode === 'payments' ? (
                <InvoiceTable invoices={invoices} onRowClick={handleRowClick} />
              ) : (
                <ClaimsTable claims={claims} onRowClick={handleClaimRowClick} />
              )}
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

