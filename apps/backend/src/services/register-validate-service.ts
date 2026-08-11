import zxcvbn from 'zxcvbn';
import { isValidIBAN } from 'ibantools';
import type { SupabaseLike } from '../db/supabase';
import type {
  ValidatePersonalRequest, ValidateAddressRequest, ValidateProfessionalRequest,
  ValidateBusinessRequest, ValidatePasswordRequest, StepValidationError,
} from '@bbw/interfaces';
import { ValidationError } from '@bbw/interfaces';
import { createAddressService } from './address/address-factory';

class DatabaseError extends Error {
  constructor(message: string, public readonly cause: unknown) {
    super(message);
    this.name = 'DatabaseError';
  }
}

async function exists(db: SupabaseLike, table: string, column: string, value: string): Promise<boolean> {
  const { data, error } = await db.from(table).select('id').eq(column, value).maybeSingle();
  if (data) return true;
  if (error && error.code === 'PGRST116') return true;
  if (error) throw new DatabaseError(`DB query failed on ${table}.${column}`, error);
  return false;
}

const CF_ODD: Record<string, number> = {
  '0':1,'1':0,'2':5,'3':7,'4':9,'5':13,'6':15,'7':17,'8':19,'9':21,
  'A':1,'B':0,'C':5,'D':7,'E':9,'F':13,'G':15,'H':17,'I':19,'J':21,
  'K':2,'L':4,'M':18,'N':20,'O':11,'P':3,'Q':6,'R':8,'S':12,'T':14,
  'U':16,'V':10,'W':22,'X':25,'Y':24,'Z':23,
};

function isValidCodiceFiscale(cf: string): boolean {
  if (!/^[A-Z0-9]{16}$/i.test(cf)) return false;
  const s = cf.toUpperCase().split('');
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    if (i % 2 === 0) {
      sum += CF_ODD[s[i]] ?? 0;
    } else {
      const c = s[i].charCodeAt(0);
      sum += c >= 48 && c <= 57 ? c - 48 : c - 65;
    }
  }
  const expected = String.fromCharCode(65 + (sum % 26));
  return s[15] === expected;
}

function err(field: string, code: string): StepValidationError {
  return { errors: { [field]: code } };
}

function mergeErrors(...results: (StepValidationError | null)[]): StepValidationError | null {
  const merged: Record<string, string> = {};
  for (const r of results) {
    if (r) Object.assign(merged, r.errors);
  }
  return Object.keys(merged).length > 0 ? { errors: merged } : null;
}

function isValidPartitaIva(piva: string): boolean {
  if (!/^\d{11}$/.test(piva)) return false;
  if (/^0{11}$/.test(piva)) return false;
  const digits = piva.split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += i % 2 === 0 ? digits[i] : (() => { const d = digits[i] * 2; return d > 9 ? d - 9 : d; })();
  }
  return (10 - (sum % 10)) % 10 === digits[10];
}

export class RegisterValidateService {
  private readonly addressService = createAddressService();

  constructor(private readonly db: SupabaseLike) {}

  async validatePersonal(data: ValidatePersonalRequest): Promise<StepValidationError | null> {
    const errors: Record<string, string> = {};

    const birthDate = new Date(data.data_nascita);
    const minDate = new Date();
    minDate.setFullYear(minDate.getFullYear() - 18);
    if (isNaN(birthDate.getTime()) || birthDate > minDate) {
      errors.data_nascita = ValidationError.MUST_BE_18_OR_OLDER;
    }

    const normalizedCf = data.codice_fiscale?.trim().toUpperCase();

    if (data.tipo_utente !== 'clinica') {
      if (!normalizedCf || !isValidCodiceFiscale(normalizedCf)) {
        errors.codice_fiscale = ValidationError.CODICE_FISCALE_INVALID;
      }
    }

    const [emailTaken, cfTaken, phoneTaken] = await Promise.all([
      exists(this.db, 'users', 'email', data.email.toLowerCase()),
      data.tipo_utente !== 'clinica' && normalizedCf
        ? exists(this.db, 'users', 'codice_fiscale', normalizedCf)
        : Promise.resolve(false),
      exists(this.db, 'users', 'telefono', data.telefono),
    ]);

    if (emailTaken) errors.email = ValidationError.ALREADY_TAKEN;
    if (cfTaken) errors.codice_fiscale = ValidationError.ALREADY_TAKEN;
    if (phoneTaken) errors.telefono = ValidationError.ALREADY_TAKEN;

    if (data.codice_riferimento) {
      const refTaken = await exists(this.db, 'users', 'codice_riferimento', data.codice_riferimento);
      if (!refTaken) errors.codice_riferimento = ValidationError.INVALID_REFERRAL_CODE;
    }

    return Object.keys(errors).length > 0 ? { errors } : null;
  }

  async validateAddress(data: ValidateAddressRequest): Promise<StepValidationError | null> {
    const valid = await this.addressService.verify(data);
    if (!valid) return err('via', ValidationError.ADDRESS_NOT_FOUND);
    return null;
  }

  async validateProfessional(data: ValidateProfessionalRequest): Promise<StepValidationError | null> {
    const errors: Record<string, string> = {};

    const alboTaken = await exists(this.db, 'professional_credentials', 'numero_albo', data.numero_albo);
    if (alboTaken) errors.numero_albo = ValidationError.ALREADY_TAKEN;

    if (data.iban && !isValidIBAN(data.iban.replace(/\s/g, ''))) {
      errors.iban = ValidationError.IBAN_INVALID;
    }

    return Object.keys(errors).length > 0 ? { errors } : null;
  }

  async validateBusiness(data: ValidateBusinessRequest): Promise<StepValidationError | null> {
    const errors: Record<string, string> = {};

    if (!isValidPartitaIva(data.partita_iva)) {
      errors.partita_iva = ValidationError.PARTITA_IVA_INVALID;
    } else {
      const pivaTaken = await exists(this.db, 'user_business_profiles', 'partita_iva', data.partita_iva);
      if (pivaTaken) errors.partita_iva = ValidationError.ALREADY_TAKEN;
    }

    if (data.iban && !isValidIBAN(data.iban.replace(/\s/g, ''))) {
      errors.iban = ValidationError.IBAN_INVALID;
    }

    return Object.keys(errors).length > 0 ? { errors } : null;
  }

  async validatePassword(data: ValidatePasswordRequest): Promise<StepValidationError | null> {
    const result = zxcvbn(data.password);
    if (result.score < 3) return err('password', ValidationError.TOO_WEAK);
    return null;
  }
}
