import type { SupabaseLike } from '../db/supabase';

export type CatalogImportRow = {
  externalCode: string;
  name: string;
  categoryCode: string;
  categoryDisplayName: string;
  categorySortOrder: number;
  durationLabel: string;
  durationMinMinutes: number;
  durationMaxMinutes: number;
  points: number;
  priceCents: number;
  bodyArea: string;
  professionalRequirements: Array<'physician' | 'beauty_professional'>;
  description: string;
};

export class CatalogImportError extends Error {
  constructor(public readonly code: string, public readonly rowNumber?: number) {
    super(code);
    this.name = 'CatalogImportError';
  }
}

const requiredHeaders = ['ID', 'Nome', 'Categoria', 'Durata', 'Punti', 'Prezzo (EUR)', 'Zona', 'Tipo Professionista', 'Descrizione'] as const;
type CsvRecord = Record<(typeof requiredHeaders)[number], string>;

function parseCsvRecords(csv: string): CsvRecord[] {
  const records: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    const next = csv[index + 1];
    if (quoted) {
      if (character === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && next === '\n') index += 1;
      row.push(field);
      field = '';
      if (row.some((value) => value.length > 0)) records.push(row);
      row = [];
    } else {
      field += character;
    }
  }

  if (quoted) throw new CatalogImportError('CATALOG_CSV_UNTERMINATED_QUOTE');
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((value) => value.length > 0)) records.push(row);
  }

  const header = records.shift() ?? [];
  if (header.length !== requiredHeaders.length || header.some((value, index) => value.trim() !== requiredHeaders[index])) {
    throw new CatalogImportError('CATALOG_CSV_INVALID_HEADERS');
  }

  return records.map((values, index) => {
    if (values.length !== requiredHeaders.length) throw new CatalogImportError('CATALOG_CSV_INVALID_COLUMN_COUNT', index + 2);
    return Object.fromEntries(requiredHeaders.map((key, column) => [key, values[column] ?? ''])) as CsvRecord;
  });
}

function slugify(value: string): string {
  return value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function requiredText(value: string, rowNumber: number, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new CatalogImportError(`CATALOG_${field.toUpperCase()}_REQUIRED`, rowNumber);
  return normalized;
}

function parseInteger(value: string, rowNumber: number, field: string, minimum = 0): number {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) throw new CatalogImportError(`CATALOG_${field.toUpperCase()}_INVALID`, rowNumber);
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < minimum) throw new CatalogImportError(`CATALOG_${field.toUpperCase()}_INVALID`, rowNumber);
  return parsed;
}

function parsePriceCents(value: string, rowNumber: number): number {
  const normalized = value.trim().replace(/€\s*/g, '').replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) throw new CatalogImportError('CATALOG_PRICE_INVALID', rowNumber);
  const [whole, fraction = ''] = normalized.split('.');
  const wholeValue = Number(whole);
  const fractionValue = Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(wholeValue) || !Number.isSafeInteger(fractionValue)) throw new CatalogImportError('CATALOG_PRICE_INVALID', rowNumber);
  const cents = wholeValue * 100 + fractionValue;
  if (!Number.isSafeInteger(cents) || cents < 0) throw new CatalogImportError('CATALOG_PRICE_INVALID', rowNumber);
  return cents;
}

function parseDuration(value: string, rowNumber: number): { min: number; max: number } {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, ' ');
  const match = normalized.match(/^(\d+)\s*(?:-\s*(\d+)\s*)?(min|mins|minuto|minuti|h|ora|ore)$/);
  if (!match) throw new CatalogImportError('CATALOG_DURATION_INVALID', rowNumber);
  const multiplier = ['h', 'ora', 'ore'].includes(match[3]) ? 60 : 1;
  const min = Number(match[1]) * multiplier;
  const max = Number(match[2] ?? match[1]) * multiplier;
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || max < min || min <= 0) {
    throw new CatalogImportError('CATALOG_DURATION_INVALID', rowNumber);
  }
  return { min, max };
}

function parseProfessionalRequirements(value: string, rowNumber: number): Array<'physician' | 'beauty_professional'> {
  const normalized = value.trim().toLocaleLowerCase('it').replace(/\s+/g, '');
  if (normalized === 'medico') return ['physician'];
  if (normalized === 'estetista') return ['beauty_professional'];
  if (normalized === 'medico/estetista') return ['physician', 'beauty_professional'];
  throw new CatalogImportError('CATALOG_PROFESSIONAL_TYPE_INVALID', rowNumber);
}

export function parseCatalogCsv(csv: string): CatalogImportRow[] {
  const records = parseCsvRecords(csv.replace(/^\uFEFF/, ''));
  const ids = new Set<string>();
  const rows = records.map((record, index) => {
    const rowNumber = index + 2;
    const externalCode = requiredText(record.ID, rowNumber, 'external_code');
    if (ids.has(externalCode)) throw new CatalogImportError('CATALOG_EXTERNAL_CODE_DUPLICATE', rowNumber);
    ids.add(externalCode);
    const categoryDisplayName = requiredText(record.Categoria, rowNumber, 'category');
    const duration = parseDuration(record.Durata, rowNumber);
    return {
      externalCode,
      name: requiredText(record.Nome, rowNumber, 'name'),
      categoryCode: slugify(categoryDisplayName),
      categoryDisplayName,
      categorySortOrder: 0,
      durationLabel: requiredText(record.Durata, rowNumber, 'duration'),
      durationMinMinutes: duration.min,
      durationMaxMinutes: duration.max,
      points: parseInteger(record.Punti, rowNumber, 'points'),
      priceCents: parsePriceCents(record['Prezzo (EUR)'], rowNumber),
      bodyArea: requiredText(record.Zona, rowNumber, 'body_area'),
      professionalRequirements: parseProfessionalRequirements(record['Tipo Professionista'], rowNumber),
      description: requiredText(record.Descrizione, rowNumber, 'description'),
    };
  });
  const categoryOrder = new Map<string, number>();
  for (const row of rows) {
    if (!categoryOrder.has(row.categoryCode)) categoryOrder.set(row.categoryCode, categoryOrder.size);
  }
  return rows.map((row) => ({
    ...row,
    categorySortOrder: categoryOrder.get(row.categoryCode) ?? 0,
  }));
}

export async function importCatalogRows(db: SupabaseLike, rows: readonly CatalogImportRow[]): Promise<{ categories: number; treatments: number }> {
  if (rows.length === 0) throw new CatalogImportError('CATALOG_IMPORT_EMPTY');
  const { data, error } = await db.rpc('import_catalog_master', {
    p_rows: rows,
  });
  if (error || !data || typeof data !== 'object') throw new CatalogImportError('CATALOG_IMPORT_FAILED');
  const result = data as { categories?: unknown; treatments?: unknown };
  if (
    typeof result.categories !== 'number'
    || typeof result.treatments !== 'number'
    || !Number.isSafeInteger(result.categories)
    || !Number.isSafeInteger(result.treatments)
  ) {
    throw new CatalogImportError('CATALOG_IMPORT_FAILED');
  }
  return { categories: result.categories, treatments: result.treatments };
}
