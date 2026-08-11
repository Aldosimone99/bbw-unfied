import type { AppRole } from '@bbw/interfaces';

export interface ResolvedUser {
  id: string;
  email: string;
  tipo_utente: AppRole;
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
