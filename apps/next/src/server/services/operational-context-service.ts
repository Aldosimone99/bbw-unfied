import { operationalContextReferenceSchema, type OperationalContext, type OperationalContextReference } from '@bbw/interfaces';

import { AuthorizationError, InvalidInputError, UnauthenticatedError } from '../../lib/errors/app-error';
import { getPostLoginContext, getOperationalContextReference } from './post-login-service';
import { setOperationalContextCookie } from './operational-context-cookie';

export function resolveOperationalContext(
  contexts: readonly OperationalContext[],
  requestedContext: OperationalContextReference | null,
): OperationalContext | null {
  if (requestedContext) {
    return contexts.find((context) => {
      const reference = context.kind === 'organization'
        ? { kind: context.kind, id: context.organizationId }
        : { kind: context.kind, id: context.professionalProfileId };
      return reference.kind === requestedContext.kind && reference.id === requestedContext.id;
    }) ?? null;
  }

  return contexts.length === 1 ? contexts[0] ?? null : null;
}

/**
 * Validates selection through the backend-derived authorization context before
 * persisting a minimal HttpOnly preference. Browser supplied labels, roles,
 * membership IDs and account IDs are intentionally ignored.
 */
export async function setActiveOperationalContext(input: OperationalContextReference): Promise<OperationalContext> {
  const parsed = operationalContextReferenceSchema.safeParse(input);
  if (!parsed.success) throw new InvalidInputError('Seleziona un contesto operativo valido.');

  const context = await getPostLoginContext(parsed.data);
  if (!context.user) throw new UnauthenticatedError();
  if (!context.activeOperationalContext) throw new AuthorizationError('operational.context');

  const resolvedReference = getOperationalContextReference(context.activeOperationalContext);
  if (resolvedReference.kind !== parsed.data.kind || resolvedReference.id !== parsed.data.id) {
    throw new AuthorizationError('operational.context');
  }

  await setOperationalContextCookie(parsed.data);
  return context.activeOperationalContext;
}
