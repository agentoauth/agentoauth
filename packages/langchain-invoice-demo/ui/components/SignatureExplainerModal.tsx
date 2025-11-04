'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, PenTool, ShieldCheck, ExternalLink } from 'lucide-react';

interface SignatureExplainerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SignatureExplainerModal({ isOpen, onClose }: SignatureExplainerModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          >
            {/* Modal */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="sticky top-0 bg-gradient-to-r from-primary-800 to-primary-600 text-white p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">🔐 Two-Layer Security</h2>
                    <p className="text-primary-100 text-sm">
                      Why AgentOAuth uses two independent signatures
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-white/80 hover:text-white transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              
              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Layer 1: Agent's Signature */}
                <div className="border-2 border-blue-200 rounded-lg p-5 bg-blue-50">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-blue-600 rounded-lg">
                      <PenTool className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-blue-900 text-lg">Layer 1: Agent&apos;s Signature (Intent)</h3>
                      <p className="text-sm text-blue-700">Signed by the AI agent</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm text-gray-700">
                    <p><strong>What it proves:</strong></p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>&quot;This agent was authorized by the user&quot;</li>
                      <li>&quot;These are the exact actions I&apos;m allowed to do&quot;</li>
                      <li>&quot;I cannot exceed these policy limits&quot;</li>
                    </ul>
                    
                    <div className="mt-3 p-3 bg-white rounded border border-blue-200 font-mono text-xs">
                      <div className="text-blue-700 font-semibold mb-1">Consent Token (JWS):</div>
                      <div className="text-gray-600">
                        header.payload.<span className="text-blue-600 font-bold">signature</span>
                      </div>
                      <div className="text-gray-500 mt-1">↑ Signed by agent&apos;s private key</div>
                    </div>
                  </div>
                </div>
                
                {/* Layer 2: Verifier's Signature */}
                <div className="border-2 border-green-200 rounded-lg p-5 bg-green-50">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-green-600 rounded-lg">
                      <ShieldCheck className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-green-900 text-lg">Layer 2: Verifier&apos;s Signature (Approval)</h3>
                      <p className="text-sm text-green-700">Signed by trusted verifier</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm text-gray-700">
                    <p><strong>What it proves:</strong></p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>&quot;I verified the agent&apos;s authorization&quot;</li>
                      <li>&quot;This specific transaction complied with the policy&quot;</li>
                      <li>&quot;Budget limits were checked and enforced&quot;</li>
                    </ul>
                    
                    <div className="mt-3 p-3 bg-white rounded border border-green-200 font-mono text-xs">
                      <div className="text-green-700 font-semibold mb-1">Receipt (JWS):</div>
                      <div className="text-gray-600">
                        header.payload.<span className="text-green-600 font-bold">signature</span>
                      </div>
                      <div className="text-gray-500 mt-1">↑ Signed by verifier&apos;s private key</div>
                    </div>
                  </div>
                </div>
                
                {/* Why It Matters */}
                <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-5">
                  <h3 className="font-bold text-yellow-900 text-lg mb-3">Why Two Signatures?</h3>
                  <div className="space-y-2 text-sm text-gray-700">
                    <p className="font-semibold text-yellow-900">If either side cheats or gets hacked, it&apos;s detectable.</p>
                    
                    <div className="space-y-1">
                      <p>✅ <strong>Rogue agent?</strong> Can&apos;t forge user authorization (missing valid signature)</p>
                      <p>✅ <strong>Compromised verifier?</strong> Can&apos;t approve without valid agent token</p>
                      <p>✅ <strong>Merchant dispute?</strong> Has cryptographic proof from both parties</p>
                      <p>✅ <strong>Audit trail?</strong> Every transaction traceable to user → agent → verifier</p>
                    </div>
                    
                    <div className="mt-3 p-3 bg-white rounded border border-yellow-300">
                      <p className="font-semibold text-gray-900 mb-1">Unforgeable Audit Trail:</p>
                      <p className="text-xs text-gray-600">
                        Intent (Agent) + Verification (Verifier) = Complete proof of authorization and compliance
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Learn More */}
                <div className="flex flex-col gap-3">
                  <a
                    href="https://verifier.agentoauth.org/docs"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold transition-colors"
                  >
                    Read Full Documentation
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  
                  <a
                    href="https://github.com/agentoauth/agentoauth"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold transition-colors"
                  >
                    View on GitHub
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

