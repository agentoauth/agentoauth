'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Check, X, Info } from 'lucide-react';
import { useEffect, useRef } from 'react';

export interface LogEntry {
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
  timestamp: number;
}

interface LogPanelProps {
  logs: LogEntry[];
  className?: string;
}

export function LogPanel({ logs, className }: LogPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);
  
  const getIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'success':
        return <Check className="w-4 h-4 text-green-600" />;
      case 'error':
        return <X className="w-4 h-4 text-red-600" />;
      case 'warning':
        return <Info className="w-4 h-4 text-yellow-600" />;
      default:
        return <Terminal className="w-4 h-4 text-gray-400" />;
    }
  };
  
  const getTextColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'success':
        return 'text-green-700';
      case 'error':
        return 'text-red-700';
      case 'warning':
        return 'text-yellow-700';
      default:
        return 'text-gray-700';
    }
  };
  
  return (
    <div className={`bg-white rounded-lg shadow-lg overflow-hidden flex flex-col ${className || 'h-[600px]'}`}>
      <div className="px-6 py-4 bg-gray-900 text-white flex items-center gap-2">
        <Terminal className="w-5 h-5" />
        <h3 className="font-bold">Agent Logs</h3>
        <div className="ml-auto text-xs text-gray-400">
          {logs.length} events
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
        <AnimatePresence initial={false}>
          {logs.map((log, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-start gap-2 text-sm"
            >
              <div className="mt-0.5">{getIcon(log.type)}</div>
              <div className={`flex-1 ${getTextColor(log.type)} font-mono text-xs`}>
                {log.message}
              </div>
              <div className="text-xs text-gray-400">
                {new Date(log.timestamp).toLocaleTimeString()}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>
      
      {logs.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <Terminal className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Waiting for agent to start...</p>
          </div>
        </div>
      )}
    </div>
  );
}

