import { describe, expect, it } from 'vitest';
import { registerRequestSchema } from '../../schemas/auth-schema';

const basePayload = {
  email: 'mario@example.com',
  password: 'Password123!',
  otp_reference: 'otp-ref-1',
  accept_terms: true,
  accept_privacy: true,
  consenso_marketing: true,
  consenso_profilazione: true,
};

describe('registerRequestSchema', () => {
  it('rejects privato as a role alias', () => {
    const result = registerRequestSchema.safeParse({
      ...basePayload,
      tipo_utente: 'privato',
    });
    expect(result.success).toBe(false);
  });

  it('requires strong passwords', () => {
    const result = registerRequestSchema.safeParse({
      ...basePayload,
      tipo_utente: 'cliente',
      password: 'Password123',
      nome: 'Mario',
      cognome: 'Rossi',
      codice_fiscale: 'RSSMRA80A01H501U',
      data_nascita: '1980-01-01',
      sesso: 'M',
    });
    expect(result.success).toBe(false);
  });

  it('accepts cliente registration payloads', () => {
    const result = registerRequestSchema.safeParse({
      ...basePayload,
      tipo_utente: 'cliente',
      nome: 'Mario',
      cognome: 'Rossi',
      codice_fiscale: 'RSSMRA80A01H501U',
      data_nascita: '1980-01-01',
      sesso: 'M',
      via: 'Via Roma 1',
      citta: 'Milano',
      provincia: 'MI',
      cap: '20100',
      nazione: 'IT',
    });
    expect(result.success).toBe(true);
  });

  it('accepts medico registration payloads with studio and credentials', () => {
    const result = registerRequestSchema.safeParse({
      ...basePayload,
      tipo_utente: 'medico',
      nome: 'Mario',
      cognome: 'Rossi',
      codice_fiscale: 'RSSMRA80A01H501U',
      data_nascita: '1980-01-01',
      sesso: 'M',
      numero_albo: 'ALBO-123',
      studio_via: 'Via Studio 2',
      studio_citta: 'Milano',
      studio_provincia: 'MI',
      studio_cap: '20100',
      dichiarazione_assenza_carichi_giudiziari: true,
    });
    expect(result.success).toBe(true);
  });

  it('requires company fiscal data for commerciale', () => {
    const result = registerRequestSchema.safeParse({
      ...basePayload,
      tipo_utente: 'commerciale',
      nome: 'Mario',
      cognome: 'Rossi',
      codice_fiscale: 'RSSMRA80A01H501U',
    });
    expect(result.success).toBe(false);
  });

  it('accepts clinica without owner codice fiscale when company data is present', () => {
    const result = registerRequestSchema.safeParse({
      ...basePayload,
      tipo_utente: 'clinica',
      nome: 'Clinica Demo',
      ragione_sociale: 'Clinica Demo SRL',
      partita_iva: '12345678901',
      pec: 'clinica@example.com',
      codice_sdi: 'ABC1234',
      azienda_via: 'Via Azienda 1',
      azienda_citta: 'Roma',
      azienda_provincia: 'RM',
      azienda_cap: '00100',
      azienda_nazione: 'IT',
    });
    expect(result.success).toBe(true);
  });
});

describe('registerRequestSchema max constraints', () => {
  it('rejects nome longer than 255 chars', () => {
    const result = registerRequestSchema.safeParse({
      tipo_utente: 'cliente',
      email: 'a@b.com',
      password: 'Aa1!Aa1!Aa1!',
      otp_reference: 'ref',
      accept_terms: true,
      accept_privacy: true,
      consenso_marketing: true,
      consenso_profilazione: true,
      nome: 'A'.repeat(256),
      cognome: 'Rossi',
      codice_fiscale: 'RSSMRA80A01H501U',
    });
    expect(result.success).toBe(false);
  });

  it('rejects codice_fiscale not exactly 16 chars', () => {
    const result = registerRequestSchema.safeParse({
      tipo_utente: 'cliente',
      email: 'a@b.com',
      password: 'Aa1!Aa1!Aa1!',
      otp_reference: 'ref',
      accept_terms: true,
      accept_privacy: true,
      consenso_marketing: true,
      consenso_profilazione: true,
      nome: 'Mario',
      cognome: 'Rossi',
      codice_fiscale: 'TOOSHORT',
    });
    expect(result.success).toBe(false);
  });

  it('accepts codice_fiscale of exactly 16 chars', () => {
    const result = registerRequestSchema.safeParse({
      tipo_utente: 'cliente',
      email: 'a@b.com',
      password: 'Aa1!Aa1!Aa1!',
      otp_reference: 'ref',
      accept_terms: true,
      accept_privacy: true,
      consenso_marketing: true,
      consenso_profilazione: true,
      nome: 'Mario',
      cognome: 'Rossi',
      codice_fiscale: 'RSSMRA80A01H501U',
    });
    expect(result.success).toBe(true);
  });
});
