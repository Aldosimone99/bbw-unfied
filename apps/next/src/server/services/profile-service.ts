import { AppError, UnauthenticatedError } from '../../lib/errors/app-error';
import type { PersonalProfileUpdateRequest } from '@bbw/interfaces';
import { requestTransitionBackend } from '../auth/transition-session';

export async function updateOwnProfile(input: PersonalProfileUpdateRequest): Promise<void> {
  const response = await requestTransitionBackend('/auth/me', {
    method: 'PUT',
    body: JSON.stringify(input),
  });

  if (response.status === 401) throw new UnauthenticatedError();
  if (!response.ok) throw new AppError('INFRASTRUCTURE', 'Profile could not be updated.');
}
