import type { AppRole } from '@bbw/interfaces';

export interface LegacyUserRow {
  auth_user_id: string;
  email: string;
  nome?: string | null;
  cognome?: string | null;
  tipo_utente: AppRole | 'privato';
  codice_fiscale?: string | null;
  deleted_at?: string | null;
  via?: string | null;
  citta?: string | null;
  ragione_sociale?: string | null;
  partita_iva?: string | null;
  numero_albo?: string | null;
  studio_citta?: string | null;
}

export function mapLegacyUserToUsers(row: LegacyUserRow) {
  if (row.deleted_at) return null;
  return {
    id: row.auth_user_id,
    email: row.email,
    nome: row.nome,
    cognome: row.cognome,
    tipo_utente: row.tipo_utente === 'privato' ? 'cliente' : row.tipo_utente,
    codice_fiscale: row.codice_fiscale,
  };
}

export function buildUsersMigration(rows: LegacyUserRow[]) {
  return rows.map(mapLegacyUserToUsers).filter((row): row is NonNullable<typeof row> => Boolean(row));
}
