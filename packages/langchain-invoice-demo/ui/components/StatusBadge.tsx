'use client';

import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react';

export type InvoiceStatus = 'pending' | 'verifying' | 'paid' | 'denied';

interface StatusBadgeProps {
  status: InvoiceStatus;
  reason?: string;
}

export function StatusBadge({ status, reason }: StatusBadgeProps) {
  const config = {
    pending: {
      icon: Clock,
      label: 'Pending',
      className: 'bg-gray-100 text-gray-600 border-gray-300',
      iconClassName: 'text-gray-500'
    },
    verifying: {
      icon: Loader2,
      label: 'Verifying...',
      className: 'bg-primary-100 text-primary-700 border-primary-300 animate-pulse-slow',
      iconClassName: 'text-primary-600 animate-spin'
    },
    paid: {
      icon: CheckCircle2,
      label: 'Paid',
      className: 'bg-green-100 text-green-700 border-green-300',
      iconClassName: 'text-green-600'
    },
    denied: {
      icon: XCircle,
      label: 'Denied',
      className: 'bg-red-100 text-red-700 border-red-300',
      iconClassName: 'text-red-600'
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
      <Icon className={`w-4 h-4 ${iconClassName}`} />
      <span>{label}</span>
    </motion.div>
  );
}

