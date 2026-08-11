export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Enums: {
      user_role: 'admin' | 'medico' | 'estetista' | 'commerciale' | 'clinica' | 'cliente';
    };
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          tipo_utente: Database['public']['Enums']['user_role'];
          nome: string | null;
          cognome: string | null;
        };
      };
    };
  };
}
