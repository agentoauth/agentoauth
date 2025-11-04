'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Fingerprint, Calendar, Check, X, AlertCircle } from 'lucide-react';
import { requestIntent, isWebAuthnSupported, type IntentDuration, type IntentV0 } from '@agentoauth/sdk/browser';

interface IntentApproverProps {
  policy: any;
  onApproved: (intent: IntentV0) => void;
  onCancel: () => void;
}

const DURATION_OPTIONS: { days: IntentDuration; label: string; description: string }[] = [
  { days: 7, label: '7 Days', description: 'Short-term tasks' },
  { days: 30, label: '30 Days', description: 'Standard approval' },
  { days: 90, label: '90 Days', description: 'Long-term delegation' }
];

export function IntentApprover({ policy, onApproved, onCancel }: IntentApproverProps) {
  const [duration, setDuration] = useState<IntentDuration>(30);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check WebAuthn support
  const webAuthnSupported = typeof window !== 'undefined' && isWebAuthnSupported();

  const handleApprove = async () => {
    setApproving(true);
    setError(null);

    try {
      // Request intent via WebAuthn
      const rpId = window.location.hostname;
      const intent = await requestIntent(policy, duration, rpId);
      
      onApproved(intent);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to approve with passkey';
      setError(errorMessage);
      console.error('Intent approval error:', err);
    } finally {
      setApproving(false);
    }
  };

  // Calculate expiry date
  const expiryDate = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);

  if (!webAuthnSupported) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-lg shadow-xl p-6 max-w-2xl mx-auto"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-yellow-100 rounded-lg">
            <AlertCircle className="w-6 h-6 text-yellow-700" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Passkey Not Supported</h2>
            <p className="text-sm text-gray-600">This browser doesn&apos;t support WebAuthn/Passkeys</p>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-gray-700">
            Your browser doesn&apos;t support passkey authentication. The demo will continue 
            without passkey approval (using basic v0.2 mode).
          </p>
          <p className="text-sm text-gray-700 mt-2">
            For the full experience, use Chrome 90+, Safari 16+, or Firefox 119+.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-white text-gray-700 border-2 border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
          >
            Continue Without Passkey
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-lg shadow-xl p-6 max-w-2xl mx-auto"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg">
          <Fingerprint className="w-8 h-8 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Approve with Passkey</h2>
          <p className="text-sm text-gray-600">Cryptographically prove your intent</p>
        </div>
      </div>

      {/* Policy Summary */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-primary-200 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-5 h-5 text-primary-700" />
          <h3 className="font-bold text-gray-900">Policy Summary</h3>
        </div>
        
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-gray-600 font-medium">Per Transaction</div>
            <div className="text-lg font-bold text-gray-900">
              ${policy.limits?.per_txn?.amount} {policy.limits?.per_txn?.currency}
            </div>
          </div>
          <div>
            <div className="text-gray-600 font-medium capitalize">
              {policy.limits?.per_period?.period}ly Budget
            </div>
            <div className="text-lg font-bold text-gray-900">
              ${policy.limits?.per_period?.amount} {policy.limits?.per_period?.currency}
            </div>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-primary-200">
          <div className="text-xs text-gray-600 font-medium mb-1">Approved Merchants:</div>
          <div className="flex flex-wrap gap-2">
            {policy.resources?.[0]?.match?.ids?.map((merchant: string) => (
              <span 
                key={merchant}
                className="px-2 py-1 bg-white text-primary-700 rounded border border-primary-300 text-xs font-medium"
              >
                {merchant}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Duration Selector */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          <Calendar className="w-4 h-4 inline mr-2" />
          How long should this approval last?
        </label>
        
        <div className="grid grid-cols-3 gap-3">
          {DURATION_OPTIONS.map(option => (
            <button
              key={option.days}
              onClick={() => setDuration(option.days)}
              disabled={approving}
              className={`
                p-4 rounded-lg border-2 transition-all
                ${duration === option.days
                  ? 'border-primary-500 bg-primary-50 shadow-md'
                  : 'border-gray-200 hover:border-primary-300 bg-white'
                }
                ${approving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <div className="text-lg font-bold text-gray-900">{option.label}</div>
              <div className="text-xs text-gray-600">{option.description}</div>
              {duration === option.days && (
                <div className="mt-2">
                  <Check className="w-5 h-5 text-primary-600 mx-auto" />
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="mt-3 text-sm text-gray-600 flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          <span>
            Expires: <strong>{expiryDate.toLocaleDateString()}</strong> at {expiryDate.toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-red-900 text-sm">Approval Failed</div>
            <div className="text-sm text-red-700 mt-1">{error}</div>
          </div>
        </motion.div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleApprove}
          disabled={approving}
          className={`
            flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold
            transition-all duration-200 shadow-lg
            ${approving
              ? 'bg-gray-400 cursor-wait' 
              : 'bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 hover:shadow-xl active:scale-95'
            }
            text-white
          `}
        >
          <Fingerprint className="w-5 h-5" />
          {approving ? 'Waiting for Passkey...' : 'Approve with Passkey'}
        </button>

        <button
          onClick={onCancel}
          disabled={approving}
          className="
            px-6 py-3 rounded-lg font-semibold
            bg-white text-gray-700 border-2 border-gray-300
            hover:bg-gray-50 transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed
          "
        >
          <X className="w-5 h-5 inline mr-2" />
          Cancel
        </button>
      </div>

      {/* Info Footer */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <div className="text-xs text-gray-600">
          <strong className="text-gray-900">🔒 Secure:</strong> Your passkey never leaves this device. 
          The approval is cryptographically bound to this specific policy.
        </div>
      </div>
    </motion.div>
  );
}

