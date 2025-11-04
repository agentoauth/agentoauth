'use client';

import { motion } from 'framer-motion';
import { ExternalLink } from 'lucide-react';
import { StatusBadge, type InvoiceStatus } from './StatusBadge';

export interface Invoice {
  invoice_id: string;
  merchant: string;
  amount: number;
  currency: string;
  description: string;
  status: InvoiceStatus;
  receipt_id?: string;
  reason?: string;
  stripe_payment_id?: string;
}

interface InvoiceTableProps {
  invoices: Invoice[];
  onRowClick?: (invoice: Invoice) => void;
}

export function InvoiceTable({ invoices, onRowClick }: InvoiceTableProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="px-6 py-4 bg-gradient-to-r from-primary-800 to-primary-600 text-white">
        <h2 className="text-xl font-bold">Invoice Processing</h2>
        <p className="text-sm text-primary-100 mt-1">
          Watch the AI agent verify and pay invoices in real-time
        </p>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Invoice ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Merchant
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Receipt
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {invoices.map((invoice, index) => (
              <motion.tr
                key={invoice.invoice_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => onRowClick?.(invoice)}
                className={`
                  transition-colors duration-200 
                  ${invoice.receipt_id ? 'cursor-pointer hover:bg-gray-50' : ''}
                  ${invoice.status === 'verifying' ? 'bg-primary-50' : ''}
                  ${invoice.status === 'paid' ? 'bg-green-50' : ''}
                  ${invoice.status === 'denied' ? 'bg-red-50' : ''}
                `}
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                  {invoice.invoice_id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="text-sm font-medium text-gray-900 capitalize">
                      {invoice.merchant}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-semibold text-gray-900">
                    ${invoice.amount.toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-500">{invoice.currency}</div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                  {invoice.description}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <StatusBadge status={invoice.status} reason={invoice.reason} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {invoice.receipt_id ? (
                    <a
                      href={`https://verifier.agentoauth.org/receipts/${invoice.receipt_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-800 font-medium"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View
                      <ExternalLink className="w-3 h-3" />
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
      
      {invoices.length === 0 && (
        <div className="px-6 py-12 text-center text-gray-500">
          <p>No invoices to display</p>
          <p className="text-sm mt-1">Click "Start Processing" to begin</p>
        </div>
      )}
    </div>
  );
}

