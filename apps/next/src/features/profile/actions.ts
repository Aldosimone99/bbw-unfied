'use server';

import { personalProfileUpdateRequestSchema } from '@bbw/interfaces';
import { revalidatePath } from 'next/cache';

import { AppError } from '../../lib/errors/app-error';
import { getFieldErrors, type FieldErrors } from '../../lib/validation/action-errors';
import { updateOwnProfile } from '../../server/services/profile-service';
import { getAddressInput, nullableFormValue } from '../authorization/profile-form-data';

export type ProfileActionState = {
  status: 'idle' | 'error' | 'success';
  message?: string;
  fieldErrors?: FieldErrors;
};

const initialState: ProfileActionState = { status: 'idle' };

export async function updateProfileAction(
  _previousState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const parsed = personalProfileUpdateRequestSchema.safeParse({
    first_name: nullableFormValue(formData, 'first_name'),
    last_name: nullableFormValue(formData, 'last_name'),
    phone: nullableFormValue(formData, 'phone'),
    birth_date: nullableFormValue(formData, 'birth_date'),
    tax_code: nullableFormValue(formData, 'tax_code'),
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
    await updateOwnProfile(parsed.data);
  } catch (error) {
    if (error instanceof AppError && error.code === 'UNAUTHENTICATED') {
      return { status: 'error', message: 'La sessione non è valida. Accedi di nuovo.' };
    }

    if (error instanceof AppError && error.code === 'FORBIDDEN') {
      return { status: 'error', message: 'Non hai il permesso di modificare questo profilo.' };
    }

    return { status: 'error', message: 'Non è stato possibile salvare il profilo. Riprova.' };
  }

  revalidatePath('/profilo');
  revalidatePath('/dashboard');

  return { status: 'success', message: 'Profilo aggiornato.' };
}

export { initialState };
