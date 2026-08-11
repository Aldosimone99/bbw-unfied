export interface ContractUser {
  id: string;
  email?: string | null;
  tipo_utente?: string | null;
}

export interface ContractProfile {
  contractType: 'professional' | 'commerciale';
  contractRole: string;
  documentRef: string;
  documentVersion: string;
  documentPath: string;
}

export function getCommercialeContractProfile(): ContractProfile {
  return {
    contractType: 'commerciale',
    contractRole: 'commerciale',
    documentRef: 'ui:commerciale_contract_20260623',
    documentVersion: 'commerciale_contract_20260623',
    documentPath: '/contracts/contratto-segnalatore-beauty-broker-world.pdf',
  };
}

export function getProfessionalContractProfile(user: ContractUser): ContractProfile | null {
  const role = String(user.tipo_utente || '').trim().toLowerCase();
  if (role !== 'medico' && role !== 'estetista' && role !== 'clinica') return null;
  const contractRole = role === 'clinica' ? 'medico' : role;
  return {
    contractType: 'professional',
    contractRole,
    documentRef: `ui:${contractRole}_platform_contract_20260623`,
    documentVersion: `${contractRole}_platform_contract_20260623`,
    documentPath: '/contracts/contratto-professionisti-beauty-broker-world.pdf',
  };
}
