import { describe, expect, it } from 'vitest';
import { deriveRegistrationOnboardingStatus } from '../../services/onboarding-status-service';

describe('registration onboarding status service', () => {
  it('marks professional contract and documents as blocking steps', () => {
    const status = deriveRegistrationOnboardingStatus({
      role: 'medico',
      contractSigned: false,
      documents: { identity: true, insurance: false, albo: false, asl: false },
      studioComplete: true,
      businessComplete: true,
    });
    expect(status.completed).toBe(false);
    expect(status.steps.find((step) => step.id === 'contract-signature')).toMatchObject({ complete: false, blocking: true });
    expect(status.steps.find((step) => step.id === 'identity-document')).toMatchObject({ complete: true });
  });

  it('marks commerciale onboarding complete when contract and iban are present', () => {
    const status = deriveRegistrationOnboardingStatus({
      role: 'commerciale',
      contractSigned: true,
      documents: {},
      businessComplete: true,
      ibanComplete: true,
    });
    expect(status.completed).toBe(true);
  });
});
