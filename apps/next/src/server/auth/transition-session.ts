import {
  operationalContextSchema,
  type OperationalContext,
  type OperationalContextReference,
  type OperationalReadiness,
} from '@bbw/interfaces';

import { createClient } from '../../lib/supabase/server';
import type { OperationalContextSummary, PermissionCode, ProfileSummary, RoleSummary } from '../../types/authorization';

const backendUrl = (process.env.BBW_BACKEND_URL ?? 'http://localhost:3001').replace(/\/$/, '');

export type TransitionUser = {
  id: string;
  email: string;
  tipo_utente: 'admin' | 'medico' | 'estetista' | 'commerciale' | 'clinica' | 'cliente' | 'privato';
  nome?: string | null;
  cognome?: string | null;
  telefono?: string | null;
  requested_account_type?: ProfileSummary['requestedAccountType'];
  onboarding_status?: ProfileSummary['onboardingStatus'];
};

export type TransitionAuthorizationContext = OperationalContextSummary & {
  user: TransitionUser;
  profile: ProfileSummary;
  globalPermissions: PermissionCode[];
  operationalPermissions: PermissionCode[];
  permissions: PermissionCode[];
  readiness: OperationalReadiness;
};

export async function getTransitionAccessToken(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function isPermissionList(value: unknown): value is PermissionCode[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function parseRoleSummaries(value: unknown): RoleSummary[] | null {
  if (!Array.isArray(value)) return null;
  const parsed = value.map((entry) => {
    if (!entry || typeof entry !== 'object') return null;
    const row = entry as Record<string, unknown>;
    return typeof row.code === 'string' && typeof row.displayName === 'string'
      ? { code: row.code, displayName: row.displayName }
      : null;
  });
  return parsed.every((entry): entry is RoleSummary => entry !== null) ? parsed : null;
}

export async function getTransitionAuthorizationContext(
  requestedContext?: OperationalContextReference | null,
): Promise<TransitionAuthorizationContext | null> {
  const accessToken = await getTransitionAccessToken();
  if (!accessToken) return null;

  const query = requestedContext
    ? `?${new URLSearchParams({ context_kind: requestedContext.kind, context_id: requestedContext.id }).toString()}`
    : '';
  const response = await fetch(`${backendUrl}/auth/context${query}`, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!response.ok) return null;

  const data = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!data || !data.user || !data.profile || !data.readiness || !isPermissionList(data.permissions)
    || !isPermissionList(data.globalPermissions) || !isPermissionList(data.operationalPermissions)) return null;

  if (!Array.isArray(data.availableOperationalContexts)) return null;
  const availableContexts: OperationalContext[] = [];
  for (const context of data.availableOperationalContexts) {
    const parsed = operationalContextSchema.safeParse(context);
    if (!parsed.success) return null;
    availableContexts.push(parsed.data);
  }

  const activeContext = data.activeOperationalContext === null
    ? null
    : operationalContextSchema.safeParse(data.activeOperationalContext);
  if (activeContext !== null && !activeContext.success) return null;

  const platformRoles = parseRoleSummaries(data.platformRoles);
  const operationalRoles = parseRoleSummaries(data.operationalRoles);
  if (!platformRoles || !operationalRoles) return null;

  return {
    user: data.user as TransitionUser,
    profile: data.profile as ProfileSummary,
    availableOperationalContexts: availableContexts,
    activeOperationalContext: activeContext === null ? null : activeContext.data,
    platformRoles,
    operationalRoles,
    globalPermissions: data.globalPermissions,
    operationalPermissions: data.operationalPermissions,
    permissions: data.permissions,
    readiness: data.readiness as OperationalReadiness,
  };
}

export async function requestTransitionBackend<T>(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T | null }> {
  const accessToken = await getTransitionAccessToken();
  if (!accessToken) return { ok: false, status: 401, data: null };

  const response = await fetch(`${backendUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`,
      ...init?.headers,
    },
    cache: 'no-store',
  });
  const data = await response.json().catch(() => null) as T | null;
  return { ok: response.ok, status: response.status, data };
}
