import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import Stripe from 'stripe';
import chalk from 'chalk';

interface VerifyAndPayToolParams {
  consentToken: string;
  stripeClient: Stripe;
  verifierUrl?: string;
}

/**
 * Create a LangChain tool that verifies authorization and processes payments
 */
export function createVerifyAndPayTool({
  consentToken,
  stripeClient,
  verifierUrl = 'https://verifier.agentoauth.org'
}: VerifyAndPayToolParams) {
  
  return new DynamicStructuredTool({
    name: 'verify_and_pay',
    description: `Verify authorization with AgentOAuth and pay invoice via Stripe.
    
This tool:
1. Verifies the payment is authorized under the policy
2. Creates a Stripe PaymentIntent if approved
3. Returns payment status with receipt ID

Use this for each invoice that needs to be paid.`,
    
    schema: z.object({
      invoice_id: z.string().describe('Unique invoice identifier'),
      merchant: z.string().describe('Merchant name (e.g., airbnb, expedia, uber)'),
      amount: z.number().describe('Payment amount in dollars'),
      currency: z.string().describe('Currency code (e.g., USD)'),
      description: z.string().describe('Payment description')
    }),
    
    func: async ({ invoice_id, merchant, amount, currency, description }) => {
      console.log(chalk.cyan(`\n🔍 Processing ${invoice_id}: ${merchant} - $${amount} ${currency}`));
      
      try {
        // Step 1: Verify with AgentOAuth
        console.log(chalk.gray('  → Verifying with AgentOAuth...'));
        
        const verifyBody = {
          token: consentToken,
          audience: 'merchant.example',
          // Context fields are at root level, not nested
          action: 'payments.send',
          resource: { type: 'merchant', id: merchant },
          amount,
          currency
        };
        
        console.log(chalk.gray(`  → Request: POST ${verifierUrl}/verify`));
        console.log(chalk.gray(`  → Context: action=${verifyBody.action}, merchant=${merchant}, amount=$${amount} ${currency}`));
        
        const verifyResponse = await fetch(`${verifierUrl}/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(verifyBody)
        });
        
        // Handle response - even 403 can have valid DENY decision
        let verifyResult;
        
        if (!verifyResponse.ok) {
          const errorText = await verifyResponse.text();
          try {
            verifyResult = JSON.parse(errorText);
          } catch {
            verifyResult = { error: errorText };
          }
          
          // Check if it's a structured DENY response (403 with decision)
          if (verifyResponse.status === 403 && verifyResult.decision === 'DENY') {
            console.log(chalk.gray(`  → Verify response (403 DENY): ${JSON.stringify(verifyResult, null, 2)}`));
            // Continue processing - we'll handle DENY below
          } else {
            // Actual error - return early
            console.log(chalk.red(`  ❌ Verification failed (${verifyResponse.status}): ${verifyResult.error || verifyResult.message || 'Unknown error'}`));
            console.log(chalk.gray(`  Debug: ${JSON.stringify(verifyResult)}`));
            return {
              status: 'VERIFICATION_FAILED',
              invoice_id,
              reason: verifyResult.error || verifyResult.message || 'Verification request failed',
              code: verifyResult.code,
              debug: verifyResult
            };
          }
        } else {
          verifyResult = await verifyResponse.json();
        }
        
        // Debug: Show full response
        console.log(chalk.gray(`  → Verify response: ${JSON.stringify(verifyResult, null, 2)}`));
        
        // Step 2: Check policy decision
        // The verifier returns { decision: "ALLOW" | "DENY", ... }
        const isAllowed = verifyResult.decision === 'ALLOW';
        const isDenied = verifyResult.decision === 'DENY';
        
        // Show remaining budget if available
        const remaining = verifyResult.remaining || verifyResult.policy_decision?.remaining;
        
        // Step 3: Create Stripe PaymentIntent for BOTH allowed and denied
        // This ensures ALL verification attempts appear in Stripe dashboard
        console.log(chalk.gray('  → Creating Stripe PaymentIntent...'));
        
        const baseMetadata = {
          invoice_id,
          merchant,
          agentoauth_decision: verifyResult.decision,
          receipt_id: verifyResult.receipt_id,
          policy_id: verifyResult.payload?.policy?.id || verifyResult.policy_id || 'unknown',
          policy_hash: verifyResult.policy_hash,
          verifier: verifierUrl,
          verification_url: `${verifierUrl}/receipts/${verifyResult.receipt_id}`,
          agentoauth_version: verifyResult.payload?.ver || 'act.v0.2'
        };
        
        if (isDenied) {
          // DENIED: Create incomplete PaymentIntent (won't be charged)
          const reason = verifyResult.reason || 'Policy check failed';
          console.log(chalk.yellow(`  ⚠️  DENIED: ${reason}`));
          
          const payment = await stripeClient.paymentIntents.create({
            amount: Math.round(amount * 100),
            currency: currency.toLowerCase(),
            description: `[DENIED] ${description}`,
            automatic_payment_methods: {
              enabled: true,
              allow_redirects: 'never'
            },
            metadata: {
              ...baseMetadata,
              deny_reason: reason,
              status: 'denied_by_policy'
            }
          });
          
          console.log(chalk.yellow(`  📋 Logged in Stripe (incomplete): ${payment.id}`));
          console.log(chalk.blue(`  📝 Receipt: ${verifierUrl}/receipts/${verifyResult.receipt_id}`));
          
          return {
            status: 'DENIED',
            invoice_id,
            merchant,
            amount,
            currency,
            reason,
            stripe_payment_id: payment.id,
            stripe_status: payment.status,
            receipt_id: verifyResult.receipt_id,
            receipt_url: `${verifierUrl}/receipts/${verifyResult.receipt_id}`,
            remaining_budget: remaining
          };
        }
        
        if (!isAllowed) {
          console.log(chalk.red(`  ❌ Unexpected decision: ${verifyResult.decision}`));
          return {
            status: 'ERROR',
            invoice_id,
            reason: 'Unexpected verifier response',
            full_response: verifyResult
          };
        }
        
        // ALLOWED: Create and confirm payment
        console.log(chalk.green('  ✅ Verified: ALLOW'));
        
        if (remaining?.period !== undefined) {
          console.log(chalk.gray(`  📊 Remaining budget: $${remaining.period} ${remaining.currency || 'USD'}`));
        }
        
        const payment = await stripeClient.paymentIntents.create({
          amount: Math.round(amount * 100), // Convert to cents
          currency: currency.toLowerCase(),
          description,
          automatic_payment_methods: {
            enabled: true,
            allow_redirects: 'never'
          },
          metadata: {
            ...baseMetadata,
            consent_token_preview: consentToken.substring(0, 50) + '...'
          }
        });
        
        const receiptUrl = `${verifierUrl}/receipts/${verifyResult.receipt_id}`;
        
        console.log(chalk.green(`  ✅ Payment created: ${payment.id}`));
        console.log(chalk.blue(`  📝 Receipt: ${receiptUrl}`));
        
        return {
          status: 'PAID',
          invoice_id,
          merchant,
          amount,
          currency,
          stripe_payment_id: payment.id,
          stripe_status: payment.status,
          receipt_id: verifyResult.receipt_id,
          receipt_url: receiptUrl,
          remaining_budget: remaining
        };
        
      } catch (error) {
        console.log(chalk.red(`  ❌ Error: ${error.message}`));
        
        return {
          status: 'ERROR',
          invoice_id,
          error: error.message,
          details: error.stack
        };
      }
    }
  });
}

