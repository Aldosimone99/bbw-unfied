INSERT INTO public.platform_treatments (slug, name, category, allowed_roles, duration, price_cents, points, description, is_active)
VALUES
  ('botox-viso', 'Botox viso', 'botox', '{"medico_estetico","medico_chirurgo"}', 30, 25000, 250, 'Trattamento botulinico per il viso', true),
  ('filler-labbra', 'Filler labbra', 'filler', '{"medico_estetico","medico_chirurgo"}', 30, 30000, 300, 'Filler acido ialuronico labbra', true),
  ('peeling-chimico', 'Peeling chimico', 'peeling', '{"medico_estetico","estetista"}', 30, 12000, 120, 'Peeling professionale viso', true),
  ('laser-epilazione', 'Laser epilazione', 'laser', '{"medico_estetico","estetista"}', 60, 18000, 180, 'Epilazione laser', true),
  ('mesoterapia-corpo', 'Mesoterapia corpo', 'mesoterapia', '{"medico_estetico"}', 30, 16000, 160, 'Mesoterapia per corpo', true),
  ('pulizia-viso', 'Pulizia viso', 'estetica_base', '{"estetista"}', 60, 9000, 90, 'Pulizia viso professionale', true),
  ('consulenza-nutrizione', 'Consulenza nutrizione', 'nutrizione', '{"dietologo"}', 60, 10000, 100, 'Consulenza nutrizionale', true),
  ('sbiancamento-dentale', 'Sbiancamento dentale', 'odontoiatria', '{"odontoiatra"}', 60, 22000, 220, 'Trattamento odontoiatrico estetico', true)
ON CONFLICT (slug) DO NOTHING;
