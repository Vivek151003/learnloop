import { updateMeSchema } from '@learnloop/shared';
import { ApiModule } from '../lib/route.js';
import * as users from '../services/users.js';
import { clearSessionCookies } from '../services/tokens.js';

export const meModule = new ApiModule('/me', 'Profile');
const anyone = ['student', 'teacher', 'admin'] as const;

meModule
  .route({ method: 'get', path: '/', summary: 'Own profile', access: [...anyone] }, ({ user }) =>
    users.getMe(user),
  )
  .route(
    {
      method: 'patch',
      path: '/',
      summary: 'Edit own profile',
      access: [...anyone],
      body: updateMeSchema,
    },
    ({ user, body }) => users.updateMe(user, body.displayName),
  )
  .route(
    {
      method: 'delete',
      path: '/',
      summary: 'Delete own account and data',
      access: [...anyone],
      status: 204,
    },
    async ({ user, res }) => {
      await users.deleteMe(user);
      clearSessionCookies(res);
    },
  );
