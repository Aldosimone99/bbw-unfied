import type { ContractStatus } from '@bbw/interfaces';
import type { SupabaseLike } from '../db/supabase';
import { getProfessionalContractProfile, type ContractUser } from './contract-profile-service';
import { recordContractSignature } from './contract-signature-service';

async function latestSignature(db: SupabaseLike, userId: string, contractType: string) {
  const { data } = await db.from('contract_signatures')
    .select('*')
    .eq('user_id', userId)
    .eq('contract_type', contractType)
    .order('signed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as { signed_at?: string } | null;
}

export async function getProfessionalContractStatus(db: SupabaseLike, user: ContractUser): Promise<ContractStatus | null> {
  const profile = getProfessionalContractProfile(user);
  if (!profile) return null;
  const signature = await latestSignature(db, user.id, 'professional');
  const isSigned = Boolean(signature?.signed_at);
  return {
    contractType: 'professional',
    contractRole: profile.contractRole,
    state: isSigned ? 'signed' : 'pending_signature',
    isSigned,
    documentRef: profile.documentRef,
    documentVersion: profile.documentVersion,
    documentPath: profile.documentPath,
    signedAt: signature?.signed_at ?? null,
    dueAt: null,
    canOperate: true,
  };
}

export async function signProfessionalContract(db: SupabaseLike, input: {
  user: ContractUser;
  signatureImageData?: string;
  signatureImageUrl?: string | null;
  usedStoredSignature?: boolean;
  ipAddress?: string;
  userAgent?: string;
}): Promise<ContractStatus | null> {
  const profile = getProfessionalContractProfile(input.user);
  if (!profile) return null;
  await recordContractSignature(db, {
    userId: input.user.id,
    contractType: 'professional',
    contractRole: profile.contractRole,
    documentRef: profile.documentRef,
    documentVersion: profile.documentVersion,
    signerRole: 'professional',
    signatureImageData: input.signatureImageData,
    signatureImageUrl: input.signatureImageUrl,
    usedStoredSignature: Boolean(input.usedStoredSignature),
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });
  return getProfessionalContractStatus(db, input.user);
}
