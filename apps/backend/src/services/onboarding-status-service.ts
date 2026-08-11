import type { AppRole, OnboardingStatus } from '@bbw/interfaces';

interface DeriveInput {
  role: AppRole;
  contractSigned: boolean;
  documents: Partial<Record<'identity' | 'insurance' | 'albo' | 'asl', boolean>>;
  studioComplete?: boolean;
  businessComplete?: boolean;
  ibanComplete?: boolean;
}

function step(id: string, label: string, complete: boolean, blocking: boolean) {
  return { id, label, complete, blocking };
}

export function deriveRegistrationOnboardingStatus(input: DeriveInput): OnboardingStatus {
  if (input.role === 'medico' || input.role === 'estetista' || input.role === 'clinica') {
    const steps = [
      step('contract-signature', 'Firma contratto', input.contractSigned, true),
      step('identity-document', 'Documento identita', Boolean(input.documents.identity), true),
      step('insurance-document', 'Polizza professionale', Boolean(input.documents.insurance), true),
      step('albo-document', 'Documento albo', input.role === 'estetista' ? true : Boolean(input.documents.albo), input.role !== 'estetista'),
      step('asl-document', 'Autorizzazione ASL', input.role === 'estetista' ? true : Boolean(input.documents.asl), input.role !== 'estetista'),
      step('studio-profile', 'Profilo studio', Boolean(input.studioComplete), false),
    ];
    return { role: input.role, steps, completed: steps.every((item) => item.complete || !item.blocking) };
  }

  if (input.role === 'commerciale') {
    const steps = [
      step('contract-signature', 'Firma contratto', input.contractSigned, true),
      step('business-profile', 'Dati fiscali', Boolean(input.businessComplete), true),
      step('iban', 'IBAN', Boolean(input.ibanComplete), true),
    ];
    return { role: input.role, steps, completed: steps.every((item) => item.complete || !item.blocking) };
  }

  return { role: input.role, completed: true, steps: [] };
}
