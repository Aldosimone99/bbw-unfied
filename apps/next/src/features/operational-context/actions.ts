"use server";

import { operationalContextReferenceSchema } from '@bbw/interfaces';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { AppError } from '../../lib/errors/app-error';
import { resolveSafePostLoginRedirect } from '../../server/security/redirects';
import { setActiveOperationalContext } from '../../server/services/operational-context-service';

export type SetOperationalContextActionState = {
  status: 'idle' | 'error';
  message?: string;
};

export async function setOperationalContextAction(
  _previousState: SetOperationalContextActionState,
  formData: FormData,
): Promise<SetOperationalContextActionState> {
  const parsed = operationalContextReferenceSchema.safeParse({
    kind: formData.get('contextKind'),
    id: formData.get('contextId'),
  });
  if (!parsed.success) return { status: 'error', message: 'Seleziona un contesto operativo valido.' };

  try {
    await setActiveOperationalContext(parsed.data);
  } catch (error) {
    if (error instanceof AppError && error.code === 'UNAUTHENTICATED') {
      return { status: 'error', message: 'La sessione non è valida. Accedi di nuovo.' };
    }
    if (error instanceof AppError && (error.code === 'INVALID_INPUT' || error.code === 'FORBIDDEN')) {
      return { status: 'error', message: 'Non puoi entrare nel contesto selezionato.' };
    }
    return { status: 'error', message: 'Non è stato possibile cambiare contesto.' };
  }

  revalidatePath('/', 'layout');
  const requestedNext = formData.get('nextDestination');
  redirect(resolveSafePostLoginRedirect(
    typeof requestedNext === 'string' ? requestedNext : undefined,
    '/dashboard',
  ));
}
