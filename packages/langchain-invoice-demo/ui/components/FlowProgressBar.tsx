'use client';

import { motion } from 'framer-motion';
import { User, Brain, Fingerprint, PenTool, ShieldCheck, Store, Check, Info } from 'lucide-react';
import { useState } from 'react';

interface FlowProgressBarProps {
  completedSteps: string[];
  currentStep: string | null;
  onSignatureClick?: () => void;
}

export function FlowProgressBar({ completedSteps, currentStep, onSignatureClick }: FlowProgressBarProps) {
  const [showTooltip, setShowTooltip] = useState<string | null>(null);
  
  const steps = [
    { id: 'input', icon: User, label: 'User Input', description: 'Describe policy needs' },
    { id: 'ai', icon: Brain, label: 'AI Generate', description: 'GPT-4 creates JSON' },
    { id: 'approval', icon: Fingerprint, label: 'User Approval', description: 'Passkey approval with time limit' },
    { id: 'signing', icon: PenTool, label: 'Agent Sign', description: 'Intent signature', hasSignature: true },
    { id: 'verification', icon: ShieldCheck, label: 'Verify', description: 'Policy check + signature', hasSignature: true },
    { id: 'payment', icon: Store, label: 'Payment', description: 'Stripe processes' }
  ];
  
  const getStepStatus = (stepId: string) => {
    if (completedSteps.includes(stepId)) return 'completed';
    if (currentStep === stepId) return 'active';
    return 'pending';
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div className="flex items-center justify-between relative">
        {steps.map((step, index) => {
          const status = getStepStatus(step.id);
          const Icon = step.icon;
          const isCompleted = status === 'completed';
          const isActive = status === 'active';
          
          return (
            <div key={step.id} className="flex items-center flex-1 relative">
              {/* Step */}
              <div 
                className="flex flex-col items-center relative z-10 flex-shrink-0"
                onMouseEnter={() => setShowTooltip(step.id)}
                onMouseLeave={() => setShowTooltip(null)}
              >
                {/* Circle */}
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: isActive ? [1, 1.1, 1] : 1 }}
                  transition={{ duration: 1, repeat: isActive ? Infinity : 0 }}
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center border-2
                    transition-all duration-300
                    ${isCompleted ? 'bg-primary-600 border-primary-600' : ''}
                    ${isActive ? 'bg-primary-100 border-primary-500 shadow-lg' : ''}
                    ${status === 'pending' ? 'bg-gray-100 border-gray-300' : ''}
                  `}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5 text-white" />
                  ) : (
                    <Icon className={`
                      w-5 h-5
                      ${isActive ? 'text-primary-700' : 'text-gray-400'}
                    `} />
                  )}
                </motion.div>
                
                {/* Label */}
                <div className="mt-1 text-center">
                  <div className={`
                    text-xs font-medium whitespace-nowrap
                    ${isCompleted || isActive ? 'text-gray-900' : 'text-gray-400'}
                  `}>
                    {step.label}
                  </div>
                  
                  {/* Signature indicator */}
                  {step.hasSignature && (isCompleted || isActive) && (
                    <button
                      onClick={onSignatureClick}
                      className="mt-0.5 text-xs hover:scale-110 transition-transform"
                      title="Click to learn about two-layer security"
                    >
                      🔐
                    </button>
                  )}
                </div>
                
                {/* Tooltip */}
                {showTooltip === step.id && (
                  <div className="absolute top-full mt-2 bg-gray-900 text-white text-xs px-3 py-2 rounded shadow-lg whitespace-nowrap z-20">
                    {step.description}
                    <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
                  </div>
                )}
              </div>
              
              {/* Connecting Line */}
              {index < steps.length - 1 && (
                <div className="flex-1 h-0.5 bg-gray-200 mx-2 relative">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ 
                      width: isCompleted ? '100%' : isActive ? '50%' : '0%'
                    }}
                    transition={{ duration: 0.5 }}
                    className="absolute top-0 left-0 h-full bg-primary-600"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Two-Layer Security Note */}
      {(completedSteps.includes('signing') || completedSteps.includes('verification')) && (
        <div className="mt-3 flex items-start gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
          <Info className="w-4 h-4 text-yellow-700 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="text-yellow-800">Two-Layer Security:</strong>{' '}
            <span className="text-gray-700">
              Agent signs intent, Verifier signs approval - creating an unforgeable audit trail.
            </span>
            {onSignatureClick && (
              <button
                onClick={onSignatureClick}
                className="ml-1 text-primary-600 hover:text-primary-800 underline"
              >
                Learn more
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

