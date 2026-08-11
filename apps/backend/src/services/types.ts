import type { PersistedUserType } from '@bbw/interfaces';

export interface ResolvedUser {
  id: string;
  email: string;
  tipo_utente: PersistedUserType;
  nome?: string | null;
  cognome?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: ResolvedUser;
      companyRole?: string;
      companyId: string | null;
    }
  }
}
