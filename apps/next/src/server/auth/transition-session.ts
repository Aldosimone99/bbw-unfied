import { createClient } from "../../lib/supabase/server";
import type { OrganizationContextSummary, PermissionCode, ProfileSummary } from "../../types/authorization";

const backendUrl = (process.env.BBW_BACKEND_URL ?? "http://localhost:3001").replace(/\/$/, "");

export type TransitionUser = {
  id: string;
  email: string;
  tipo_utente: "admin" | "medico" | "estetista" | "commerciale" | "clinica" | "cliente" | "privato";
  nome?: string | null;
  cognome?: string | null;
  telefono?: string | null;
  requested_account_type?: ProfileSummary["requestedAccountType"];
  onboarding_status?: ProfileSummary["onboardingStatus"];
};

export type TransitionAuthorizationContext = {
  user: TransitionUser;
  profile: ProfileSummary;
  memberships: OrganizationContextSummary['memberships'];
  activeOrganization: OrganizationContextSummary['activeOrganization'];
  globalPermissions: PermissionCode[];
  organizationPermissions: PermissionCode[];
  permissions: PermissionCode[];
};

export async function getTransitionAccessToken(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function getTransitionAuthorizationContext(): Promise<TransitionAuthorizationContext | null> {
  const accessToken = await getTransitionAccessToken();
  if (!accessToken) return null;

  const response = await fetch(`${backendUrl}/auth/context`, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store"
  });
  if (!response.ok) return null;

  const data = await response.json().catch(() => null) as Partial<TransitionAuthorizationContext> | null;
  if (!data?.user || !data.profile || !Array.isArray(data.permissions)) return null;
  return data as TransitionAuthorizationContext;
}

export async function requestTransitionBackend<T>(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T | null }> {
  const accessToken = await getTransitionAccessToken();
  if (!accessToken) return { ok: false, status: 401, data: null };

  const response = await fetch(`${backendUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
      ...init?.headers
    },
    cache: "no-store"
  });
  const data = await response.json().catch(() => null) as T | null;
  return { ok: response.ok, status: response.status, data };
}

export async function getTransitionOrganizationContext(userId: string): Promise<OrganizationContextSummary> {
  const accessToken = await getTransitionAccessToken();
  if (!accessToken) return { memberships: [], activeOrganization: null };

  const response = await fetch(`${backendUrl}/users/me/companies`, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store"
  });
  if (!response.ok) return { memberships: [], activeOrganization: null };

  const payload = await response.json().catch(() => null) as { data?: Array<{ id: string; name: string; role: string }> } | null;
  const memberships = (payload?.data ?? []).map((company) => ({
    id: company.id,
    organizationId: company.id,
    organizationDisplayName: company.name,
    organizationTypeCode: null,
    organizationTypeDisplayName: null,
    organizationStatus: "active",
    status: "active",
    joinedAt: null,
    roles: [{ code: company.role, displayName: company.role }]
  }));

  return { memberships, activeOrganization: memberships[0] ?? null };
}
