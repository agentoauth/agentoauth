import { buildPolicyV2 } from '@agentoauth/sdk';
import crypto from 'crypto';

/**
 * Create a travel policy with per-transaction and weekly limits
 */
export function createTravelPolicy() {
  const policyId = `pol_travel_${crypto.randomBytes(8).toString('hex')}`;
  
  return buildPolicyV2()
    .id(policyId)
    .actions(['payments.send'])
    .merchants(['airbnb', 'expedia', 'uber'])
    .limitPerTxn(500, 'USD')
    .limitPerPeriod(2000, 'USD', 'week')
    // Removed time constraints for demo simplicity (can be added back)
    .strict(true)
    .meta({ 
      note: 'Business travel policy - 24/7 demo mode',
      created: new Date().toISOString(),
      department: 'Finance'
    })
    .finalize();
}

