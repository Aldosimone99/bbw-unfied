import type { SupabaseClient } from "@supabase/supabase-js";

import { AppError } from "../../lib/errors/app-error";
import type { AccountTypeCode, AccountTypeStatus } from "../../types/authorization";

export type Row = Record<string, unknown>;

function asRow(value: unknown): Row | null {
  return typeof value === "object" && value !== null ? (value as Row) : null;
}

function asRows(value: unknown): Row[] {
  return Array.isArray(value) ? value.flatMap((item) => (asRow(item) ? [asRow(item) as Row] : [])) : [];
}

function requiredString(row: Row, field: string): string {
  const value = row[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new AppError("INFRASTRUCTURE", `Invalid authorization data: ${field}`);
  }
  return value;
}

function optionalString(row: Row, field: string): string | null {
  const value = row[field];
  return typeof value === "string" ? value : null;
}

function optionalRow(row: Row, field: string): Row | null {
  return asRow(row[field]);
}

function booleanValue(row: Row, field: string): boolean {
  return row[field] === true;
}

async function throwOnError(error: { message?: string } | null): Promise<void> {
  if (error) {
    throw new AppError("INFRASTRUCTURE", "Authorization data could not be loaded.");
  }
}

export async function findProfileByUserId(client: SupabaseClient, userId: string) {
  const { data, error } = await client
    .from("profiles")
    .select("id, user_id, first_name, last_name, phone, onboarding_intent, account_type_status, onboarding_status")
    .eq("user_id", userId)
    .maybeSingle();
  await throwOnError(error);

  const row = asRow(data);
  if (!row) {
    return null;
  }

  const onboardingStatus = requiredString(row, "onboarding_status");
  if (!["profile_required", "account_type_required", "context_required", "completed"].includes(onboardingStatus)) {
    throw new AppError("INFRASTRUCTURE", "Invalid onboarding status.");
  }

  const requestedAccountType = optionalString(row, "onboarding_intent");
  if (requestedAccountType !== null && !["personal", "healthcare_professional", "beauty_professional", "organization", "commercial"].includes(requestedAccountType)) {
    throw new AppError("INFRASTRUCTURE", "Invalid requested account type.");
  }

  const accountTypeStatus = requiredString(row, "account_type_status");
  if (!["not_required", "pending", "approved", "rejected"].includes(accountTypeStatus)) {
    throw new AppError("INFRASTRUCTURE", "Invalid account type status.");
  }

  return {
    id: requiredString(row, "id"),
    userId: requiredString(row, "user_id"),
    firstName: optionalString(row, "first_name"),
    lastName: optionalString(row, "last_name"),
    phone: optionalString(row, "phone"),
    requestedAccountType: requestedAccountType as AccountTypeCode | null,
    accountTypeStatus: accountTypeStatus as AccountTypeStatus,
    onboardingStatus: onboardingStatus as "profile_required" | "account_type_required" | "context_required" | "completed"
  };
}

export async function findActiveOrganizationTypes(client: SupabaseClient): Promise<Row[]> {
  const { data, error } = await client
    .from("organization_types")
    .select("code, display_name")
    .eq("is_active", true)
    .order("code", { ascending: true });
  await throwOnError(error);
  return asRows(data);
}

export async function findMembershipRows(client: SupabaseClient, userId: string): Promise<Row[]> {
  const { data, error } = await client
    .from("organization_members")
    .select("id, organization_id, status, joined_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  await throwOnError(error);
  return asRows(data);
}

export async function findOrganizationsByIds(client: SupabaseClient, ids: string[]): Promise<Row[]> {
  if (ids.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from("organizations")
    .select("id, display_name, status, organization_type:organization_types(code, display_name)")
    .in("id", ids);
  await throwOnError(error);
  return asRows(data);
}

export async function findMemberRoleRows(client: SupabaseClient, membershipIds: string[]): Promise<Row[]> {
  if (membershipIds.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from("member_roles")
    .select("organization_member_id, role_id")
    .in("organization_member_id", membershipIds);
  await throwOnError(error);
  return asRows(data);
}

export async function findAccountRoleRows(client: SupabaseClient, userId: string): Promise<Row[]> {
  const { data, error } = await client.from("account_roles").select("role_id").eq("user_id", userId);
  await throwOnError(error);
  return asRows(data);
}

export async function findRolesByIds(client: SupabaseClient, ids: string[]): Promise<Row[]> {
  if (ids.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from("roles")
    .select("id, code, display_name, scope, is_active")
    .in("id", ids);
  await throwOnError(error);
  return asRows(data).filter((row) => booleanValue(row, "is_active"));
}

export async function findRolePermissionRows(client: SupabaseClient, roleIds: string[]): Promise<Row[]> {
  if (roleIds.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from("role_permissions")
    .select("role_id, permission_id")
    .in("role_id", roleIds);
  await throwOnError(error);
  return asRows(data);
}

export async function findPermissionsByIds(client: SupabaseClient, ids: string[]): Promise<Row[]> {
  if (ids.length === 0) {
    return [];
  }

  const { data, error } = await client.from("permissions").select("id, code").in("id", ids);
  await throwOnError(error);
  return asRows(data);
}

export { requiredString, optionalString, optionalRow, booleanValue };
