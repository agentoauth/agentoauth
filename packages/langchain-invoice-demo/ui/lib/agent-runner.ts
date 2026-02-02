import { request } from '@agentoauth/sdk';
import { generateKeyPair, exportJWK } from 'jose';
import Stripe from 'stripe';
import crypto from 'crypto';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

export interface AgentEvent {
  type: 'log' | 'invoice_start' | 'invoice_complete' | 'claim_complete' | 'complete' | 'error';
  level?: 'info' | 'success' | 'error' | 'warning';
  message?: string;
  invoice_id?: string;
  claim_id?: string;
  status?: string;
  amount?: number;
  reason?: string;
  receipt_id?: string;
  stripe_payment_id?: string;
  paid?: number;
  denied?: number;
  context_hash?: string;
  context_summary?: string;
  decision_notes?: string;
}

export interface ClaimInput {
  claim_id: string;
  loss_type: string;
  amount: number;
  currency: string;
  coverage_confirmed: boolean;
  docs_complete: boolean;
}

export interface RunAgentOptions {
  mode?: 'payments' | 'claims';
  claims?: ClaimInput[];
  intent?: any;
}

export async function runAgent(
  policy: any,
  onEvent: (event: AgentEvent) => void | Promise<void>,
  intentOrOptions?: any
): Promise<void> {
  const options: RunAgentOptions =
    intentOrOptions != null && typeof intentOrOptions === 'object' && !('valid_until' in intentOrOptions) && (intentOrOptions.mode != null || intentOrOptions.claims != null)
      ? intentOrOptions
      : { intent: intentOrOptions };
  const { mode = 'payments', claims: claimsFromOptions, intent } = options;

  try {
    const verifierUrl = process.env.VERIFIER_URL || 'https://verifier.agentoauth.org';

    if (mode === 'claims') {
      // Claims mode: use claims, build context, no Stripe
      const claims = claimsFromOptions ?? [];
      await onEvent({ type: 'log', level: 'info', message: '📄 Loading claims...' });
      await onEvent({ type: 'log', level: 'success', message: `✅ Loaded ${claims.length} claims` });

      const { buildContextBlob, canonicalizeContext, computeContextHash, buildContextSummary } = await import('@/lib/context-builder');
      const policyThreshold = policy?.limits?.per_txn?.amount;
      const processedClaimIds = new Set<string>();

      await onEvent({ type: 'log', level: 'info', message: '🔑 Generating signing keypair...' });
      const { privateKey, publicKey } = await generateKeyPair('EdDSA');
      const privateJWK = await exportJWK(privateKey);
      const publicJWK = await exportJWK(publicKey);
      publicJWK.alg = 'EdDSA';
      publicJWK.kid = 'claims-agent-key-1';
      await onEvent({ type: 'log', level: 'success', message: '✅ Keypair generated' });

      await onEvent({ type: 'log', level: 'info', message: '📋 Using settlement authority policy...' });
      await onEvent({ type: 'log', level: 'success', message: `✅ Policy: $${policy.limits.per_txn.amount}/txn threshold` });

      await onEvent({ type: 'log', level: 'info', message: '🎫 Issuing consent token...' });
      const { hashPolicy } = await import('@agentoauth/sdk');
      const payload: any = {
        ver: intent ? 'act.v0.3' as const : 'act.v0.2' as const,
        jti: crypto.randomUUID(),
        user: 'did:user:alice',
        agent: 'did:agent:claims-assistant',
        scope: 'payments.send',
        limit: { amount: policy.limits.per_period.amount, currency: policy.limits.per_period.currency },
        policy,
        policy_hash: hashPolicy(policy),
        iss: 'claims.example.com',
        aud: 'merchant.example',
        exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60),
        nonce: crypto.randomUUID()
      };
      if (intent) {
        payload.intent = intent;
      }
      const token = await request(payload, privateJWK, publicJWK.kid);
      await onEvent({ type: 'log', level: 'success', message: '✅ Consent token issued' });

      let allowedCount = 0;
      let deniedCount = 0;

      for (const claim of claims) {
        await onEvent({ type: 'invoice_start', invoice_id: claim.claim_id, claim_id: claim.claim_id });
        await onEvent({ type: 'log', level: 'info', message: `🔍 Verifying ${claim.claim_id} ($${claim.amount})...` });

        if (claim.claim_id === 'CLM-91825' && processedClaimIds.has(claim.claim_id)) {
          await onEvent({ type: 'log', level: 'warning', message: `⚠️ ${claim.claim_id} BLOCKED — Authority already consumed` });
          await onEvent({
            type: 'claim_complete',
            claim_id: claim.claim_id,
            invoice_id: claim.claim_id,
            status: 'BLOCKED',
            amount: claim.amount,
            reason: 'Authority already consumed'
          });
          deniedCount++;
          continue;
        }

        const contextBlob = buildContextBlob(claim, { policyThreshold });
        const canonical = canonicalizeContext(contextBlob);
        const context_hash = computeContextHash(canonical);
        const context_summary = buildContextSummary(contextBlob, { policyThreshold });
        const decision_notes = `Claim ${claim.claim_id}: ${claim.loss_type}, $${claim.amount}. Coverage: ${claim.coverage_confirmed ? 'Yes' : 'No'}, Docs: ${claim.docs_complete ? 'Yes' : 'No'}. Threshold: $${policyThreshold ?? 'N/A'}.`;

        const verifyResponse = await fetch(`${verifierUrl}/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            audience: 'merchant.example',
            action: 'payments.send',
            resource: { type: 'merchant', id: 'claims' },
            amount: claim.amount,
            currency: claim.currency
          })
        });

        let verifyResult: { decision: string; reason?: string; error?: string; receipt_id?: string };
        if (!verifyResponse.ok) {
          const errorText = await verifyResponse.text();
          verifyResult = JSON.parse(errorText);
          if (verifyResponse.status !== 403 || verifyResult.decision !== 'DENY') {
            throw new Error(`Verification failed: ${(verifyResult as any).error || 'Unknown error'}`);
          }
        } else {
          verifyResult = await verifyResponse.json();
        }

        const allowed = verifyResult.decision !== 'DENY';
        const denyReason = verifyResult.reason ?? verifyResult.error ?? 'Policy check failed';
        if (allowed) processedClaimIds.add(claim.claim_id);

        if (allowed) {
          allowedCount++;
          await onEvent({ type: 'log', level: 'success', message: `✅ ${claim.claim_id} ALLOWED ($${claim.amount})` });
        } else {
          deniedCount++;
          await onEvent({ type: 'log', level: 'warning', message: `⚠️ ${claim.claim_id} DENIED: ${denyReason}` });
        }

        await onEvent({
          type: 'claim_complete',
          claim_id: claim.claim_id,
          invoice_id: claim.claim_id,
          status: allowed ? 'ALLOW' : 'DENY',
          amount: claim.amount,
          reason: allowed ? undefined : denyReason,
          receipt_id: verifyResult.receipt_id,
          context_hash,
          context_summary,
          decision_notes
        });
      }

      await onEvent({ type: 'complete', paid: allowedCount, denied: deniedCount });
      await onEvent({ type: 'log', level: 'success', message: `🎉 Processing complete: ${allowedCount} allowed, ${deniedCount} denied` });
      return;
    }

    // Payments mode
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY not configured');
    }

    await onEvent({ type: 'log', level: 'info', message: '📄 Loading invoices...' });
    const invoices = [
      { invoice_id: 'inv_001', merchant: 'airbnb', amount: 300, currency: 'USD', description: 'Hotel reservation - San Francisco', status: 'pending' },
      { invoice_id: 'inv_002', merchant: 'expedia', amount: 700, currency: 'USD', description: 'Flight tickets - NYC to SFO', status: 'pending' },
      { invoice_id: 'inv_003', merchant: 'uber', amount: 150, currency: 'USD', description: 'Airport transportation', status: 'pending' }
    ];
    await onEvent({ type: 'log', level: 'success', message: `✅ Loaded ${invoices.length} invoices` });
    
    // Step 2: Generate keypair
    await onEvent({ type: 'log', level: 'info', message: '🔑 Generating signing keypair...' });
    const { privateKey, publicKey } = await generateKeyPair('EdDSA');
    const privateJWK = await exportJWK(privateKey);
    const publicJWK = await exportJWK(publicKey);
    publicJWK.alg = 'EdDSA';
    publicJWK.kid = 'finance-agent-key-1';
    await onEvent({ type: 'log', level: 'success', message: '✅ Keypair generated' });
    
    // Step 3: Use provided policy
    await onEvent({ type: 'log', level: 'info', message: '📋 Using AI-generated policy...' });
    await onEvent({ type: 'log', level: 'success', message: `✅ Policy: $${policy.limits.per_txn.amount}/txn, $${policy.limits.per_period.amount}/${policy.limits.per_period.period}` });
    
    // Step 4: Issue token
    await onEvent({ type: 'log', level: 'info', message: '🎫 Issuing consent token...' });
    const { hashPolicy } = await import('@agentoauth/sdk');
    
    const payload: any = {
      ver: intent ? 'act.v0.3' as const : 'act.v0.2' as const,
      jti: crypto.randomUUID(),
      user: 'did:user:alice',
      agent: 'did:agent:finance-assistant',
      scope: 'payments.send',
      limit: {
        amount: policy.limits.per_period.amount,
        currency: policy.limits.per_period.currency
      },
      policy,
      policy_hash: hashPolicy(policy),
      iss: 'finance.example.com',
      aud: 'merchant.example',
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60),
      nonce: crypto.randomUUID()
    };

    // Add intent if provided (v0.3)
    if (intent) {
      payload.intent = intent;
      await onEvent({ type: 'log', level: 'success', message: `✅ Including passkey approval (valid until ${new Date(intent.valid_until).toLocaleDateString()})` });
    }
    
    const token = await request(payload, privateJWK, publicJWK.kid);
    await onEvent({ type: 'log', level: 'success', message: '✅ Consent token issued' });
    
    // Step 5: Initialize Stripe
    await onEvent({ type: 'log', level: 'info', message: '💳 Initializing Stripe...' });
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-02-24.acacia'
    });
    await onEvent({ type: 'log', level: 'success', message: '✅ Stripe initialized' });
    
    // Step 6: Process invoices
    let paidCount = 0;
    let deniedCount = 0;
    
    for (const invoice of invoices) {
      await onEvent({
        type: 'invoice_start',
        invoice_id: invoice.invoice_id
      });
      
      await onEvent({
        type: 'log',
        level: 'info',
        message: `🔍 Verifying ${invoice.invoice_id} ($${invoice.amount})...`
      });
      
      // Verify with AgentOAuth
      const verifyResponse = await fetch(`${verifierUrl}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          audience: 'merchant.example',
          action: 'payments.send',
          resource: { type: 'merchant', id: invoice.merchant },
          amount: invoice.amount,
          currency: invoice.currency
        })
      });
      
      let verifyResult;
      if (!verifyResponse.ok) {
        const errorText = await verifyResponse.text();
        verifyResult = JSON.parse(errorText);
        if (verifyResponse.status !== 403 || verifyResult.decision !== 'DENY') {
          throw new Error(`Verification failed: ${verifyResult.error || 'Unknown error'}`);
        }
      } else {
        verifyResult = await verifyResponse.json();
      }
      
      const isDenied = verifyResult.decision === 'DENY';
      
      // Create Stripe PaymentIntent
      const baseMetadata = {
        invoice_id: invoice.invoice_id,
        merchant: invoice.merchant,
        agentoauth_decision: verifyResult.decision,
        receipt_id: verifyResult.receipt_id,
        policy_id: policy.id,
        verifier: verifierUrl
      };
      
      let payment;
      
      if (isDenied) {
        const reason = verifyResult.reason || 'Policy check failed';
        
        payment = await stripe.paymentIntents.create({
          amount: Math.round(invoice.amount * 100),
          currency: invoice.currency.toLowerCase(),
          description: `[DENIED] ${invoice.description}`,
          automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
          metadata: {
            ...baseMetadata,
            deny_reason: reason,
            status: 'denied_by_policy'
          }
        });
        
        await onEvent({
          type: 'log',
          level: 'warning',
          message: `⚠️  ${invoice.invoice_id} DENIED: ${reason}`
        });
        
        deniedCount++;
      } else {
        payment = await stripe.paymentIntents.create({
          amount: Math.round(invoice.amount * 100),
          currency: invoice.currency.toLowerCase(),
          description: invoice.description,
          automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
          metadata: baseMetadata
        });
        
        await onEvent({
          type: 'log',
          level: 'success',
          message: `✅ ${invoice.invoice_id} PAID ($${invoice.amount})`
        });
        
        paidCount++;
      }
      
      await onEvent({
        type: 'invoice_complete',
        invoice_id: invoice.invoice_id,
        status: isDenied ? 'DENIED' : 'PAID',
        amount: invoice.amount,
        reason: isDenied ? verifyResult.reason : undefined,
        receipt_id: verifyResult.receipt_id,
        stripe_payment_id: payment.id
      });
    }
    
    // Complete
    await onEvent({
      type: 'complete',
      paid: paidCount,
      denied: deniedCount
    });
    
    await onEvent({
      type: 'log',
      level: 'success',
      message: `🎉 Processing complete: ${paidCount} paid, ${deniedCount} denied`
    });
    
  } catch (error) {
    await onEvent({
      type: 'error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

