import { describe, expect, it } from 'vitest';
import { isTreatmentAllowedForUser, resolveCatalogRoles } from '../../services/catalog-roles-service';

describe('catalog-roles-service', () => {
  it('returns all catalog roles for admin and clinica', () => {
    expect(resolveCatalogRoles({ tipo_utente: 'admin' })).toContain('medico_estetico');
    expect(resolveCatalogRoles({ tipo_utente: 'clinica' })).toContain('estetista');
  });

  it('maps estetista directly', () => {
    expect(resolveCatalogRoles({ tipo_utente: 'estetista' })).toEqual(['estetista']);
  });

  it('defaults medico to medico_estetico when no specialization is present', () => {
    expect(resolveCatalogRoles({ tipo_utente: 'medico' })).toEqual(['medico_estetico']);
  });

  it('maps medico specializzazioni to unique catalog roles', () => {
    expect(resolveCatalogRoles({
      tipo_utente: 'medico',
      specializzazioni: ['chirurgia-plastica', 'odontoiatria', 'chirurgia-plastica'],
    })).toEqual(['medico_chirurgo', 'odontoiatra']);
  });

  it('returns no catalog roles for cliente', () => {
    expect(resolveCatalogRoles({ tipo_utente: 'cliente' })).toEqual([]);
  });

  it('evaluates allowed_roles semantics', () => {
    const user = { tipo_utente: 'medico', specializzazioni: ['odontoiatria'] };
    expect(isTreatmentAllowedForUser(null, user)).toBe(true);
    expect(isTreatmentAllowedForUser([], user)).toBe(false);
    expect(isTreatmentAllowedForUser(['odontoiatra'], user)).toBe(true);
    expect(isTreatmentAllowedForUser(['estetista'], user)).toBe(false);
  });
});
