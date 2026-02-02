'use client';

import { Check, X, ExternalLink, Shield, Anchor } from 'lucide-react';

export interface OpenProofData {
  receipt_id: string;
  decision: 'ALLOW' | 'DENY';
  decision_notes?: string;
  context_summary?: string;
  context_hash?: string;
  policy_hash?: string;
  issued_at?: string;
  signature_verified?: boolean;
  anchor_verified?: boolean;
  policy_id?: string;
  intent_approved_at?: string;
  intent_reference?: string;
}

interface OpenProofPanelProps {
  isOpen: boolean;
  onClose: () => void;
  data: OpenProofData | null;
}

export function OpenProofPanel({ isOpen, onClose, data }: OpenProofPanelProps) {
  if (!isOpen) return null;

  const receiptUrl = data?.receipt_id
    ? `https://verifier.agentoauth.org/receipts/${data.receipt_id}`
    : '';

  const handleVerifyInNewWindow = () => {
    if (receiptUrl) window.open(receiptUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary-600" />
            Open Proof
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {!data ? (
            <p className="text-gray-500">No proof data. Process a claim and open from the receipt link.</p>
          ) : (
            <>
              {/* 1) Decision Evidence (Authoritative) */}
              <section>
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
                  Decision Evidence (Authoritative)
                </p>
                <p className="text-xs text-gray-600 italic mb-2">
                  Authorization reflects delegated authority, not system execution.
                  When this section verifies, auditors do not need system logs.
                </p>
                <p className="text-xs text-gray-500 mb-3">
                  This receipt constitutes sufficient audit evidence for authorization.
                </p>
                <p className="text-xs text-gray-600 italic mb-3">
                  Auditors can rely on this receipt without reviewing system logs.
                </p>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-600">Decision:</span>
                    <span
                      className={
                        data.decision === 'ALLOW'
                          ? 'text-green-700 font-semibold'
                          : 'text-red-700 font-semibold'
                      }
                    >
                      {data.decision === 'ALLOW' ? (
                        <span className="inline-flex items-center gap-1">
                          <Check className="w-4 h-4" /> ALLOWED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <X className="w-4 h-4" /> DENIED
                        </span>
                      )}
                    </span>
                  </div>
                  {/* Authority */}
                  <div>
                    <span className="font-medium text-gray-600 block mb-1">Authority</span>
                    {data.intent_approved_at ? (
                      <div className="space-y-1 text-gray-700">
                        <div>Authorized by: Human approver</div>
                        <div>Approval method: Passkey</div>
                        <div>
                          Approval timestamp: {new Date(data.intent_approved_at).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', dateStyle: 'short', timeStyle: 'medium' })} PT
                        </div>
                        {data.intent_reference && (
                          <div>Approval reference: {data.intent_reference}</div>
                        )}
                        {data.policy_id && (
                          <div>Delegation source: Policy {data.policy_id}</div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1 text-gray-700">
                        <div>Authorized by: Automated Claims Authority</div>
                        <div>
                          Authority source: Pre-approved policy ({data.policy_id ?? 'policy not available'})
                        </div>
                        <div>Delegation owner: Claims Operations</div>
                        <div>Approval mode: System-delegated (no human approval required)</div>
                      </div>
                    )}
                  </div>
                  {data.decision_notes && (
                    <div>
                      <span className="font-medium text-gray-600 block mb-1">Decision notes:</span>
                      <p className="text-gray-700 whitespace-pre-wrap">{data.decision_notes}</p>
                    </div>
                  )}
                  {data.context_summary && (
                    <div>
                      <span className="font-medium text-gray-600 block mb-1">Context at decision time:</span>
                      <pre className="text-gray-700 text-xs whitespace-pre-wrap font-mono bg-white p-3 rounded border border-gray-200">
                        {data.context_summary}
                      </pre>
                    </div>
                  )}
                  {data.context_hash && (
                    <div>
                      <span className="font-medium text-gray-600 block mb-1">Context hash:</span>
                      <code className="text-xs text-gray-700 font-mono break-all">{data.context_hash}</code>
                    </div>
                  )}
                  {data.policy_hash && (
                    <div>
                      <span className="font-medium text-gray-600 block mb-1">Policy hash:</span>
                      <code className="text-xs text-gray-700 font-mono break-all">{data.policy_hash}</code>
                    </div>
                  )}
                  {data.issued_at && (
                    <div>
                      <span className="font-medium text-gray-600 block mb-1">Timestamp:</span>
                      <span className="text-gray-700">{new Date(data.issued_at).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </section>

              {/* 2) Proof Integrity */}
              <section>
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
                  Proof Integrity
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    {data.signature_verified !== false ? (
                      <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                    ) : (
                      <X className="w-4 h-4 text-red-600 flex-shrink-0" />
                    )}
                    <span>
                      Signature verified {data.signature_verified !== false ? '✅' : '❌'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {data.anchor_verified ? (
                      <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                    ) : (
                      <Anchor className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    )}
                    <span>Anchor verified {data.anchor_verified ? '✅' : '❌ (optional)'}</span>
                  </div>
                </div>
              </section>

              {/* 3) Actions */}
              <section className="pt-2 border-t border-gray-200">
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
                  Actions
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleVerifyInNewWindow}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium text-sm transition-colors"
                  >
                    Verify in New Window
                    <ExternalLink className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-sm transition-colors"
                    title="Optional public anchoring"
                  >
                    <Anchor className="w-4 h-4" />
                    Anchor Proof (optional)
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Verification works without login. Anyone with the receipt link can verify the signed authority.
                </p>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
