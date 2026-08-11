export function normalizePngSignatureDataUrl(value: string): string {
  const normalized = String(value || '').trim();
  if (!normalized.startsWith('data:image/png;base64,')) {
    throw new Error('SIGNATURE_INVALID');
  }
  const encoded = normalized.slice('data:image/png;base64,'.length);
  if (!encoded || !/^[A-Za-z0-9+/=]+$/.test(encoded)) {
    throw new Error('SIGNATURE_INVALID');
  }
  return normalized;
}
