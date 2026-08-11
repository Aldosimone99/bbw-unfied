import type { SupabaseLike } from '../db/supabase';

export async function resolveCatalogPricing(db: SupabaseLike, serviceId: string | null, professionalId: string, companyId: string | null) {
  if (!serviceId) return { priceCents: null, points: null };

  const { data: platform } = await db
    .from('professional_catalog_effective')
    .select('effective_price_cents, effective_points')
    .eq('assignment_id', serviceId)
    .eq('professional_id', professionalId)
    .maybeSingle();
  if (platform) return { priceCents: platform.effective_price_cents, points: platform.effective_points };

  const { data: custom } = await db
    .from('professional_catalog_items')
    .select('custom_price_cents, points_override, custom_services(price_cents, points)')
    .eq('id', serviceId)
    .eq('professional_id', professionalId)
    .maybeSingle();
  if (!custom) return { priceCents: null, points: null };

  return {
    priceCents: custom.custom_price_cents ?? custom.custom_services?.price_cents ?? null,
    points: custom.points_override ?? custom.custom_services?.points ?? null,
  };
}
