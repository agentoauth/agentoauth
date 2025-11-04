'use client';

import { motion } from 'framer-motion';
import { User, Brain, PenTool, ShieldCheck, Store, ChevronRight } from 'lucide-react';

type FlowStep = 'input' | 'ai' | 'signing' | 'verification' | 'payment' | null;

interface FlowDiagramProps {
  currentStep: FlowStep;
  policyGenerated?: boolean;
}

export function FlowDiagram({ currentStep, policyGenerated }: FlowDiagramProps) {
  const steps = [
    {
      id: 'input',
      icon: User,
      title: 'User Input',
      description: 'Describe policy in plain English',
      color: 'blue'
    },
    {
      id: 'ai',
      icon: Brain,
      title: 'AI Generation',
      description: 'GPT-4 creates policy JSON',
      color: 'purple'
    },
    {
      id: 'signing',
      icon: PenTool,
      title: 'Agent Signs',
      description: '🔐 Signature #1 (Intent)',
      color: 'blue',
      isSignature: true
    },
    {
      id: 'verification',
      icon: ShieldCheck,
      title: 'Verifier Checks',
      description: '🔐 Signature #2 (Verification)',
      color: 'green',
      isSignature: true
    },
    {
      id: 'payment',
      icon: Store,
      title: 'Merchant Payment',
      description: 'Stripe processes transaction',
      color: 'green'
    }
  ];
  
  const getStepStatus = (stepId: string) => {
    const stepOrder = ['input', 'ai', 'signing', 'verification', 'payment'];
    const currentIndex = currentStep ? stepOrder.indexOf(currentStep) : -1;
    const stepIndex = stepOrder.indexOf(stepId);
    
    if (currentIndex === -1) return 'pending';
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'active';
    return 'pending';
  };
  
  const getColorClasses = (color: string, status: string) => {
    if (status === 'pending') {
      return {
        bg: 'bg-gray-100',
        text: 'text-gray-400',
        border: 'border-gray-300'
      };
    }
    if (status === 'active') {
      if (color === 'purple') {
        return {
          bg: 'bg-purple-100 animate-pulse-slow',
          text: 'text-purple-700',
          border: 'border-purple-500'
        };
      }
      return {
        bg: `bg-${color}-100 animate-pulse-slow`,
        text: `text-${color}-700`,
        border: `border-${color}-500`
      };
    }
    // completed
    if (color === 'purple') {
      return {
        bg: 'bg-purple-100',
        text: 'text-purple-700',
        border: 'border-purple-400'
      };
    }
    return {
      bg: `bg-${color}-100`,
      text: `text-${color}-700`,
      border: `border-${color}-400`
    };
  };
  
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Processing Flow</h2>
      <div className="flex items-center justify-between gap-2">
        {steps.map((step, index) => {
          const status = getStepStatus(step.id);
          const colors = getColorClasses(step.color, status);
          const Icon = step.icon;
          
          return (
            <div key={step.id} className="flex items-center gap-2 flex-1">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: index * 0.1 }}
                className="flex-1"
              >
                <div className={`
                  relative p-4 rounded-lg border-2 transition-all duration-300
                  ${colors.bg} ${colors.border}
                  ${status === 'active' ? 'shadow-lg' : ''}
                `}>
                  <div className="flex flex-col items-center text-center">
                    <Icon className={`w-6 h-6 ${colors.text} mb-2`} />
                    <div className={`text-sm font-bold ${colors.text}`}>{step.title}</div>
                    <div className="text-xs text-gray-600 mt-1">{step.description}</div>
                  </div>
                  
                  {step.isSignature && status !== 'pending' && (
                    <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
                      <div className="bg-white px-2 py-1 rounded-full border-2 border-yellow-400 text-xs font-bold text-yellow-700 shadow-sm">
                        🔐
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
              
              {index < steps.length - 1 && (
                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
              )}
            </div>
          );
        })}
      </div>
      
      {policyGenerated && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-gray-700">
          <strong className="text-yellow-800">Two-Layer Security:</strong> Each transaction gets two independent signatures -
          one from the Agent proving intent, one from the Verifier proving compliance. This creates an
          unforgeable audit trail.
        </div>
      )}
    </div>
  );
}

