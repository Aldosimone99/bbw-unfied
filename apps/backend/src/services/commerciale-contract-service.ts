import type { ContractStatus } from '@bbw/interfaces';
import type { SupabaseLike } from '../db/supabase';
import { getCommercialeContractProfile, type ContractUser } from './contract-profile-service';
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

export async function getCommercialeContractStatus(db: SupabaseLike, user: ContractUser): Promise<ContractStatus> {
  const profile = getCommercialeContractProfile();
  const signature = await latestSignature(db, user.id, 'commerciale');
  const isSigned = Boolean(signature?.signed_at);
  return {
    contractType: 'commerciale',
    contractRole: profile.contractRole,
    state: isSigned ? 'signed' : 'pending_signature',
    isSigned,
    documentRef: profile.documentRef,
    documentVersion: profile.documentVersion,
    documentPath: profile.documentPath,
    signedAt: signature?.signed_at ?? null,
    dueAt: null,
    canOperate: isSigned,
  };
}

export async function signCommercialeContract(db: SupabaseLike, input: {
  user: ContractUser;
  signatureImageData?: string;
  signatureImageUrl?: string | null;
  usedStoredSignature?: boolean;
  ipAddress?: string;
  userAgent?: string;
}): Promise<ContractStatus> {
  const profile = getCommercialeContractProfile();
  await recordContractSignature(db, {
    userId: input.user.id,
    contractType: 'commerciale',
    contractRole: profile.contractRole,
    documentRef: profile.documentRef,
    documentVersion: profile.documentVersion,
    signerRole: 'commerciale',
    signatureImageData: input.signatureImageData,
    signatureImageUrl: input.signatureImageUrl,
    usedStoredSignature: Boolean(input.usedStoredSignature),
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });
  return getCommercialeContractStatus(db, input.user);
}
