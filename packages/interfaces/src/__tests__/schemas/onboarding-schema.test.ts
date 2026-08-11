import { describe, expect, it } from 'vitest';
import { onboardingCompletionRequestSchema } from '../../schemas/onboarding-schema';

describe('onboardingCompletionRequestSchema', () => {
  it('accepts a personal account without an organization name', () => {
    const result = onboardingCompletionRequestSchema.safeParse({
      account_type: 'personal',
      organization_display_name: null,
    });

    expect(result.success).toBe(true);
  });

  it('requires an organization name for organization onboarding', () => {
    const result = onboardingCompletionRequestSchema.safeParse({
      account_type: 'organization',
      organization_display_name: null,
    });

    expect(result.success).toBe(false);
  });
});
