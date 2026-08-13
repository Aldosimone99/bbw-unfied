import { describe, expect, it, vi } from 'vitest';
import type { SupabaseLike } from '../../db/supabase';
import {
  CatalogImportError,
  importCatalogRows,
  parseCatalogCsv,
} from '../../services/catalog-import-service';

const header = 'ID,Nome,Categoria,Durata,Punti,Prezzo (EUR),Zona,Tipo Professionista,Descrizione';

function csvRow(values: string[]): string {
  return values.map((value) => `"${value.replaceAll('"', '""')}"`).join(',');
}

describe('catalog CSV importer', () => {
  it('parses minutes, ranges, hours, integer cents and professional mappings', () => {
    const rows = parseCatalogCsv([
      header,
      csvRow(['T-001', 'Trattamento singolo', 'Viso', '30 min', '1', '12,50', 'Viso', 'Medico', 'Descrizione uno']),
      csvRow(['T-002', 'Trattamento range', 'Corpo', '30-45 min', '2', '99.9', 'Corpo', 'Estetista', 'Descrizione due']),
      csvRow(['T-003', 'Trattamento ore', 'Viso', '2-3 ore', '3', '100', 'Viso', 'Medico/Estetista', 'Descrizione tre']),
    ].join('\n'));

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ durationMinMinutes: 30, durationMaxMinutes: 30, priceCents: 1250, professionalRequirements: ['physician'] });
    expect(rows[1]).toMatchObject({ durationMinMinutes: 30, durationMaxMinutes: 45, priceCents: 9990, professionalRequirements: ['beauty_professional'] });
    expect(rows[2]).toMatchObject({ durationMinMinutes: 120, durationMaxMinutes: 180, priceCents: 10000, professionalRequirements: ['physician', 'beauty_professional'] });
    expect(rows[0]?.categorySortOrder).toBe(0);
    expect(rows[1]?.categorySortOrder).toBe(1);
    expect(rows[2]?.categorySortOrder).toBe(0);
  });

  it('rejects duplicate external IDs', () => {
    const row = csvRow(['T-001', 'Trattamento', 'Viso', '30 min', '1', '10', 'Viso', 'Medico', 'Descrizione']);
    expect(() => parseCatalogCsv([header, row, row].join('\n'))).toThrowError(
      expect.objectContaining({ code: 'CATALOG_EXTERNAL_CODE_DUPLICATE', rowNumber: 3 }),
    );
  });

  it('uses idempotent upserts for categories and treatments', async () => {
    const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const db = {
      rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
        rpcCalls.push({ name, args });
        return { data: { categories: 2, treatments: 2 }, error: null };
      }),
    } as unknown as SupabaseLike;
    const rows = parseCatalogCsv([
      header,
      csvRow(['T-001', 'Trattamento uno', 'Viso', '30 min', '1', '10', 'Viso', 'Medico', 'Descrizione']),
      csvRow(['T-002', 'Trattamento due', 'Corpo', '45 min', '2', '20', 'Corpo', 'Estetista', 'Descrizione']),
    ].join('\n'));

    await expect(importCatalogRows(db, rows)).resolves.toEqual({ categories: 2, treatments: 2 });
    await expect(importCatalogRows(db, rows)).resolves.toEqual({ categories: 2, treatments: 2 });
    expect(rpcCalls).toHaveLength(2);
    expect(rpcCalls.every(({ name }) => name === 'import_catalog_master')).toBe(true);
    expect(rpcCalls.every(({ args }) => Array.isArray(args.p_rows) && args.p_rows.length === 2)).toBe(true);
  });

  it('exposes typed importer errors for invalid values', () => {
    const row = csvRow(['T-001', 'Trattamento', 'Viso', 'tempo', '1', '10', 'Viso', 'Medico', 'Descrizione']);
    try {
      parseCatalogCsv([header, row].join('\n'));
      throw new Error('expected parser failure');
    } catch (error) {
      expect(error).toBeInstanceOf(CatalogImportError);
      expect(error).toMatchObject({ code: 'CATALOG_DURATION_INVALID', rowNumber: 2 });
    }
  });
});
