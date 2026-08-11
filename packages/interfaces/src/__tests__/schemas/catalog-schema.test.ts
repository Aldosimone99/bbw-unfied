import { describe, expect, it } from 'vitest';
import {
  adoptTreatmentRequestSchema,
  catalogAssignmentSchema,
  createAssignmentRequestSchema,
  createCustomServiceRequestSchema,
  platformTreatmentSchema,
} from '../../schemas/catalog-schema';

describe('catalog schemas', () => {
  it('requires exactly one assignment source', () => {
    expect(createAssignmentRequestSchema.parse({
      platformTreatmentId: '11111111-1111-4111-8111-111111111111',
    }).platformTreatmentId).toBeDefined();

    expect(() => createAssignmentRequestSchema.parse({
      platformTreatmentId: '11111111-1111-4111-8111-111111111111',
      companyCatalogId: '22222222-2222-4222-8222-222222222222',
    })).toThrow();
  });

  it('validates custom service duration as a 30-minute multiple', () => {
    expect(createCustomServiceRequestSchema.parse({
      name: 'Servizio custom',
      duration: 60,
      priceCents: 10000,
    }).duration).toBe(60);

    expect(() => createCustomServiceRequestSchema.parse({
      name: 'Servizio custom',
      duration: 45,
      priceCents: 10000,
    })).toThrow();
  });

  it('parses platform treatment and assignment rows', () => {
    expect(platformTreatmentSchema.parse({
      id: '11111111-1111-4111-8111-111111111111',
      slug: 'botox-viso',
      name: 'Botox viso',
      category: 'botox',
      allowed_roles: ['medico_estetico'],
      duration: 30,
      price_cents: 25000,
      points: 250,
      is_active: true,
    }).slug).toBe('botox-viso');

    expect(catalogAssignmentSchema.parse({
      assignment_id: '22222222-2222-4222-8222-222222222222',
      professional_id: '33333333-3333-4333-8333-333333333333',
      platform_treatment_id: '11111111-1111-4111-8111-111111111111',
      name: 'Botox viso',
      category: 'botox',
      effective_price_cents: 25000,
      effective_duration_min: 30,
      effective_points: 250,
      effective_consent_template_id: null,
      disclaimer_accepted: false,
      is_active: true,
      is_public: false,
    }).name).toBe('Botox viso');
  });

  it('validates clinic adoption payloads', () => {
    expect(adoptTreatmentRequestSchema.parse({
      platformTreatmentId: '22222222-2222-4222-8222-222222222222',
    }).platformTreatmentId).toBeDefined();
  });
});
