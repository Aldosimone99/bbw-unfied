import { operationalContextReferenceSchema, type OperationalContextReference } from '@bbw/interfaces';
import { cookies } from 'next/headers';

export const activeOperationalContextCookieName = 'bbw-active-operational-context';

export function parseOperationalContextCookie(value: string | undefined): OperationalContextReference | null {
  if (!value) return null;

  try {
    const parsed = operationalContextReferenceSchema.safeParse(JSON.parse(value) as unknown);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function getRequestedOperationalContext(): Promise<OperationalContextReference | null> {
  return parseOperationalContextCookie((await cookies()).get(activeOperationalContextCookieName)?.value);
}

export async function setOperationalContextCookie(context: OperationalContextReference): Promise<void> {
  const parsed = operationalContextReferenceSchema.safeParse(context);
  if (!parsed.success) throw new Error('INVALID_OPERATIONAL_CONTEXT');

  (await cookies()).set(activeOperationalContextCookieName, JSON.stringify(parsed.data), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}
