'use server';

import { organizationProfileUpdateRequestSchema } from '@bbw/interfaces';
import { revalidatePath } from 'next/cache';

import { AppError } from '../../lib/errors/app-error';
import { getFieldErrors, type FieldErrors } from '../../lib/validation/action-errors';
import { updateOwnOrganizationProfile } from '../../server/services/organization-profile-service';
import { getAddressInput, nullableFormValue } from '../authorization/profile-form-data';

export type OrganizationProfileActionState = {
  status: 'idle' | 'error' | 'success';
  message?: string;
  fieldErrors?: FieldErrors;
};

export const initialOrganizationProfileActionState: OrganizationProfileActionState = { status: 'idle' };

export async function updateOrganizationProfileAction(
  organizationId: string,
  _previousState: OrganizationProfileActionState,
  formData: FormData,
): Promise<OrganizationProfileActionState> {
  const parsed = organizationProfileUpdateRequestSchema.safeParse({
    legal_name: nullableFormValue(formData, 'legal_name'),
    display_name: nullableFormValue(formData, 'display_name'),
    tax_identifier: nullableFormValue(formData, 'tax_identifier'),
    email: nullableFormValue(formData, 'email'),
    phone: nullableFormValue(formData, 'phone'),
    address: getAddressInput(formData),
  });

  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Controlla i dati inseriti.',
      fieldErrors: getFieldErrors(parsed.error),
    };
  }

  try {
    await updateOwnOrganizationProfile(organizationId, parsed.data);
  } catch (error) {
    if (error instanceof AppError && error.code === 'UNAUTHENTICATED') {
      return { status: 'error', message: 'La sessione non è valida. Accedi di nuovo.' };
    }
    if (error instanceof AppError && error.code === 'FORBIDDEN') {
      return { status: 'error', message: 'Non hai il permesso di modificare questa organizzazione.' };
    }
    return { status: 'error', message: 'Non è stato possibile salvare l’organizzazione. Riprova.' };
  }

  revalidatePath('/organizzazione');
  revalidatePath('/dashboard');
  return { status: 'success', message: 'Profilo organizzazione aggiornato.' };
}
