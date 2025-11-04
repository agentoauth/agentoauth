'use client';

import { Shield, DollarSign, Calendar, Store } from 'lucide-react';

interface PolicyCardProps {
  policy: {
    id: string;
    limits: {
      per_txn: { amount: number; currency: string };
      per_period: { amount: number; currency: string; period: string };
    };
    resources: Array<{ type: string; match: { ids: string[] } }>;
  };
}

export function PolicyCard({ policy }: PolicyCardProps) {
  const merchants = policy.resources[0]?.match?.ids || [];
  
  return (
    <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-primary-200">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-primary-100 rounded-lg">
          <Shield className="w-6 h-6 text-primary-700" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900">Active Policy</h3>
          <p className="text-xs text-gray-500 font-mono">{policy.id}</p>
        </div>
      </div>
      
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
        
        {/* Weekly budget */}
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Calendar className="w-5 h-5 text-blue-700" />
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium">Weekly budget</div>
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

