import { createHash } from 'node:crypto';
import type { SupabaseLike } from '../db/supabase';
import { normalizePngSignatureDataUrl } from './signature-service';

interface RecordContractSignatureInput {
  userId: string;
  contractType: 'professional' | 'commerciale';
  contractRole: string;
  documentRef: string;
  documentVersion: string;
  signerRole: string;
  signatureImageData?: string;
  signatureImageUrl?: string | null;
  usedStoredSignature: boolean;
  ipAddress?: string;
  userAgent?: string;
}

function buildSignatureHash(input: RecordContractSignatureInput): string {
  return createHash('sha256')
    .update(JSON.stringify({
      userId: input.userId,
      contractType: input.contractType,
      contractRole: input.contractRole,
      documentRef: input.documentRef,
      documentVersion: input.documentVersion,
      signerRole: input.signerRole,
      signatureImageData: input.signatureImageData ?? null,
      signatureImageUrl: input.signatureImageUrl ?? null,
      usedStoredSignature: input.usedStoredSignature,
    }))
    .digest('hex');
}

export async function recordContractSignature(db: SupabaseLike, input: RecordContractSignatureInput): Promise<void> {
  const signatureImageData = input.signatureImageData
    ? normalizePngSignatureDataUrl(input.signatureImageData)
    : undefined;
  const signatureHash = buildSignatureHash({ ...input, signatureImageData });

  const { error } = await db.from('contract_signatures').insert({
    user_id: input.userId,
    contract_type: input.contractType,
    contract_role: input.contractRole,
    document_ref: input.documentRef,
    document_version: input.documentVersion,
    signer_role: input.signerRole,
    signature_method: 'GRAPHOMETRIC',
    signature_image_url: input.signatureImageUrl ?? null,
    signature_image_data: signatureImageData,
    used_stored_signature: input.usedStoredSignature,
    ip_address: input.ipAddress,
    user_agent: input.userAgent,
    signature_hash: signatureHash,
  });
  if (error) throw new Error('CONTRACT_SIGNATURE_RECORD_FAILED');
}
