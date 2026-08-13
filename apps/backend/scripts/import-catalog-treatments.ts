import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { createSupabaseServerClient } from '../src/db/supabase';
import { importCatalogRows, parseCatalogCsv } from '../src/services/catalog-import-service';

const csvPath = resolve(process.cwd(), '../../docs/Files/catalogo_trattamenti.csv');
const csv = await readFile(csvPath, 'utf8');
const rows = parseCatalogCsv(csv);
const result = await importCatalogRows(createSupabaseServerClient(), rows);
console.log(`Imported ${result.treatments} catalog treatments across ${result.categories} categories from ${csvPath}`);
