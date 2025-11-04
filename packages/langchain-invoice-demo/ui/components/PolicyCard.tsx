'use client';

import { useState } from 'react';
import { Shield, DollarSign, Calendar, Store, Sparkles, Code, Copy, Check } from 'lucide-react';

interface PolicyCardProps {
  policy: {
    id: string;
    limits: {
      per_txn: { amount: number; currency: string };
      per_period: { amount: number; currency: string; period: string };
    };
    resources: Array<{ type: string; match: { ids: string[] } }>;
    meta?: {
      generated_by?: string;
      user_description?: string;
      [key: string]: any;
    };
  };
}

export function PolicyCard({ policy }: PolicyCardProps) {
  const merchants = policy.resources[0]?.match?.ids || [];
  const [showJson, setShowJson] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const isAiGenerated = policy.meta?.generated_by === 'AI';
  
  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(policy, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-primary-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-100 rounded-lg">
            <Shield className="w-6 h-6 text-primary-700" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-gray-900">Active Policy</h3>
              {isAiGenerated && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 text-xs font-semibold rounded-full">
                  <Sparkles className="w-3 h-3" />
                  AI Generated
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 font-mono">{policy.id}</p>
          </div>
        </div>
        
        <button
          onClick={() => setShowJson(!showJson)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-primary-700 hover:text-primary-900 hover:bg-primary-50 rounded-lg transition-colors"
        >
          <Code className="w-4 h-4" />
          {showJson ? 'Hide JSON' : 'View JSON'}
        </button>
      </div>
      
      {/* User Description */}
      {isAiGenerated && policy.meta?.user_description && (
        <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="text-xs text-purple-700 font-medium mb-1">Your Request:</div>
          <div className="text-sm text-gray-700 italic">&quot;{policy.meta.user_description}&quot;</div>
        </div>
      )}
      
      {/* JSON Viewer */}
      {showJson && (
        <div className="mb-4">
          <div className="relative">
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs font-mono max-h-64 overflow-y-auto">
              {JSON.stringify(policy, null, 2)}
            </pre>
            <button
              onClick={handleCopyJson}
              className="absolute top-2 right-2 p-2 bg-gray-700 hover:bg-gray-600 rounded text-white transition-colors"
              title="Copy to clipboard"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <div className="mt-2 flex gap-2">
            <a
              href="https://verifier.agentoauth.org/play"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary-600 hover:text-primary-800 hover:underline"
            >
              Open in Playground →
            </a>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Per-transaction limit */}
        <div className="flex items-start gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <DollarSign className="w-5 h-5 text-green-700" />
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium">Per-transaction</div>
            <div className="text-lg font-bold text-gray-900">
              ${policy.limits.per_txn.amount}
            </div>
            <div className="text-xs text-gray-500">{policy.limits.per_txn.currency}</div>
          </div>
        </div>
        
        {/* Period budget */}
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Calendar className="w-5 h-5 text-blue-700" />
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium capitalize">{policy.limits.per_period.period}ly budget</div>
            <div className="text-lg font-bold text-gray-900">
              ${policy.limits.per_period.amount}
            </div>
            <div className="text-xs text-gray-500">{policy.limits.per_period.currency}</div>
          </div>
        </div>
        
        {/* Merchants */}
        <div className="flex items-start gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Store className="w-5 h-5 text-purple-700" />
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium">Allowed merchants</div>
            <div className="text-sm font-semibold text-gray-900 mt-1">
              {merchants.slice(0, 2).join(', ')}
              {merchants.length > 2 && (
                <span className="text-gray-500"> +{merchants.length - 2}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

