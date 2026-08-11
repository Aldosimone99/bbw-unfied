export const verificationQueries = [
  'SELECT COUNT(*) FROM legacy.users WHERE deleted_at IS NULL;',
  'SELECT COUNT(*) FROM public.users;',
  "SELECT COUNT(*) FROM public.users WHERE tipo_utente::text = 'privato';",
  `SELECT COUNT(*) FROM public.users u
LEFT JOIN public.professional_credentials pc ON pc.user_id = u.id
WHERE u.tipo_utente IN ('medico', 'estetista', 'commerciale')
  AND pc.user_id IS NULL;`,
];
