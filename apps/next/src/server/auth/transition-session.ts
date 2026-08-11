import { createClient } from "../../lib/supabase/server";
import type { OrganizationContextSummary, ProfileSummary } from "../../types/authorization";

const backendUrl = (process.env.BBW_BACKEND_URL ?? "http://localhost:3001").replace(/\/$/, "");

export type TransitionUser = {
  id: string;
  email: string;
  tipo_utente: "admin" | "medico" | "estetista" | "commerciale" | "clinica" | "cliente";
  nome?: string | null;
  cognome?: string | null;
  telefono?: string | null;
};

export async function getTransitionAccessToken(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function getTransitionUser(): Promise<TransitionUser | null> {
  const accessToken = await getTransitionAccessToken();
  if (!accessToken) return null;

  const response = await fetch(`${backendUrl}/auth/me`, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store"
  });
  if (!response.ok) return null;

  const data = await response.json().catch(() => null);
  return data && typeof data === "object" && typeof data.id === "string" && typeof data.tipo_utente === "string"
    ? data as TransitionUser
    : null;
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

export function profileFromTransitionUser(user: TransitionUser): ProfileSummary {
  const accountTypeByRole: Record<TransitionUser["tipo_utente"], ProfileSummary["requestedAccountType"]> = {
    admin: "personal",
    cliente: "personal",
    medico: "healthcare_professional",
    estetista: "beauty_professional",
    clinica: "organization",
    commerciale: "commercial"
  };

  return {
    id: user.id,
    userId: user.id,
    firstName: user.nome ?? null,
    lastName: user.cognome ?? null,
    phone: user.telefono ?? null,
    requestedAccountType: accountTypeByRole[user.tipo_utente],
    accountTypeStatus: "not_required",
    onboardingStatus: "completed"
  };
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
