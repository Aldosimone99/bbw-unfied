export const ValidationError = {
  REQUIRED:               'required',
  INVALID_FORMAT:         'invalid_format',
  ALREADY_TAKEN:          'already_taken',
  MUST_BE_18_OR_OLDER:    'must_be_18_or_older',
  INVALID_REFERRAL_CODE:  'invalid_referral_code',
  ADDRESS_NOT_FOUND:      'address_not_found',
  TOO_WEAK:               'too_weak',
  IBAN_INVALID:           'iban_invalid',
  PARTITA_IVA_INVALID:    'partita_iva_invalid',
  CODICE_FISCALE_INVALID: 'codice_fiscale_invalid',
} as const;

export type ValidationErrorKey = typeof ValidationError[keyof typeof ValidationError];
