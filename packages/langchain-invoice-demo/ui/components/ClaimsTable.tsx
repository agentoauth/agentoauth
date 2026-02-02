'use client';

import { motion } from 'framer-motion';
import { ExternalLink, Check, X, Loader2, Clock, ShieldAlert } from 'lucide-react';

export type ClaimDecisionStatus = 'pending' | 'verifying' | 'allowed' | 'denied' | 'blocked';

export interface Claim {
  claim_id: string;
  loss_type: string;
  amount: number;
  currency: string;
  coverage_confirmed: boolean;
  docs_complete: boolean;
  status: ClaimDecisionStatus;
  receipt_id?: string;
  reason?: string;
  context_hash?: string;
  context_summary?: string;
  decision_notes?: string;
}

interface ClaimsTableProps {
  claims: Claim[];
  onRowClick?: (claim: Claim) => void;
}

function DecisionBadge({ status, reason }: { status: ClaimDecisionStatus; reason?: string }) {
  const config: Record<ClaimDecisionStatus, { icon: typeof Clock; label: string; className: string; iconClassName: string }> = {
    pending: {
      icon: Clock,
      label: 'Pending',
      className: 'bg-gray-100 text-gray-600 border-gray-300',
      iconClassName: 'text-gray-500'
    },
    verifying: {
      icon: Loader2,
      label: 'Verifying...',
      className: 'bg-primary-100 text-primary-700 border-primary-300 animate-pulse',
      iconClassName: 'text-primary-600 animate-spin'
    },
    allowed: {
      icon: Check,
      label: 'Allowed',
      className: 'bg-green-100 text-green-700 border-green-300',
      iconClassName: 'text-green-600'
    },
    denied: {
      icon: X,
      label: 'Denied',
      className: 'bg-red-100 text-red-700 border-red-300',
      iconClassName: 'text-red-600'
    },
    blocked: {
      icon: ShieldAlert,
      label: 'Blocked — Authority already consumed',
      className: 'bg-amber-100 text-amber-800 border-amber-300',
      iconClassName: 'text-amber-600'
    }
  };
  const { icon: Icon, label, className, iconClassName } = config[status];
  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${className}`}
      title={reason}
    >
      <Icon className={`w-4 h-4 flex-shrink-0 ${iconClassName}`} />
      <span className="whitespace-nowrap">{label}</span>
    </motion.div>
  );
}

export function ClaimsTable({ claims, onRowClick }: ClaimsTableProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="px-6 py-4 bg-gradient-to-r from-primary-800 to-primary-600 text-white">
        <h2 className="text-xl font-bold">Claims Settlement</h2>
        <p className="text-sm text-primary-100 mt-1">
          Authority decisions and receipts for each claim
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Claim ID
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Loss Type
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Coverage
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Docs
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Decision
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 sticky right-0 shadow-[-4px_0_8px_rgba(0,0,0,0.06)]">
                Receipt
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {claims.map((claim, index) => (
              <motion.tr
                key={claim.claim_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => claim.receipt_id && onRowClick?.(claim)}
                className={`
                  transition-colors duration-200
                  ${claim.receipt_id ? 'cursor-pointer hover:bg-gray-50' : ''}
                  ${claim.status === 'verifying' ? 'bg-primary-50' : ''}
                  ${claim.status === 'allowed' ? 'bg-green-50' : ''}
                  ${claim.status === 'denied' ? 'bg-red-50' : ''}
                  ${claim.status === 'blocked' ? 'bg-amber-50' : ''}
                `}
              >
                <td className="px-3 py-3 whitespace-nowrap text-sm font-mono text-gray-900">
                  {claim.claim_id}
                </td>
                <td className="px-3 py-3 text-sm text-gray-900 max-w-[100px] truncate" title={claim.loss_type}>
                  {claim.loss_type}
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <div className="text-sm font-semibold text-gray-900">
                    ${claim.amount.toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-500">{claim.currency}</div>
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-sm">
                  {claim.coverage_confirmed ? (
                    <span className="text-green-600" title="Yes">✅</span>
                  ) : (
                    <span className="text-red-600" title="No">❌</span>
                  )}
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-sm">
                  {claim.docs_complete ? (
                    <span className="text-green-600" title="Yes">✅</span>
                  ) : (
                    <span className="text-red-600" title="No">❌</span>
                  )}
                </td>
                <td className="px-3 py-3 text-sm">
                  <DecisionBadge status={claim.status} reason={claim.reason} />
                </td>
                <td className={`px-3 py-3 whitespace-nowrap text-sm sticky right-0 shadow-[-4px_0_8px_rgba(0,0,0,0.06)] ${claim.status === 'verifying' ? 'bg-primary-50' : claim.status === 'allowed' ? 'bg-green-50' : claim.status === 'denied' ? 'bg-red-50' : claim.status === 'blocked' ? 'bg-amber-50' : 'bg-white'}`}>
                  {claim.receipt_id ? (
                    <a
                      href={`https://verifier.agentoauth.org/receipts/${claim.receipt_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-800 font-medium"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View proof →
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    </a>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {claims.length === 0 && (
        <div className="px-6 py-12 text-center text-gray-500">
          <p>No claims to display</p>
          <p className="text-sm mt-1">Click &quot;Start Processing&quot; to begin</p>
        </div>
      )}
    </div>
  );
}
