import { redirect } from 'next/navigation';

type LegacyPatientDetailPageProps = { params: Promise<{ id: string }> };

export default async function LegacyPatientDetailPage({ params }: LegacyPatientDetailPageProps) {
  const { id } = await params;
  redirect(`/pazienti/${encodeURIComponent(id)}`);
}
