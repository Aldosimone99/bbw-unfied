import { describe, expect, it } from 'vitest';
import { buildUsersMigration } from './migrate-users-onboarding';

describe('buildUsersMigration', () => {
  it('converts privato to cliente and skips deleted users', () => {
    const rows = buildUsersMigration([
      { auth_user_id: 'u1', email: 'a@example.com', tipo_utente: 'privato' },
      { auth_user_id: 'u2', email: 'b@example.com', tipo_utente: 'medico', deleted_at: '2026-01-01' },
    ]);

    expect(rows).toEqual([{ id: 'u1', email: 'a@example.com', nome: undefined, cognome: undefined, tipo_utente: 'cliente', codice_fiscale: undefined }]);
  });
});
